import { FilePlus } from 'lucide-react'
import React, { useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
  Input,
  Label,
} from '~/components/ui'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import type {
  VendorImportPreviewResponse,
  VendorImportConfirmResponse,
} from '~/lib/OwnerStatement/vendor-import'
import { formatCurrency } from '~/lib/utils/format'
import { tryCatch } from '~/lib/utils/try-catch'
import { api } from '~/trpc/react'

interface MonthlyVendorImporterProps {
  currentStatementId: string
  onSuccess?: () => void
}

type ProcessingStep = 'upload' | 'ai-processing' | 'preview' | 'confirming' | 'complete'

export default function MonthlyVendorImporter({
  currentStatementId,
  onSuccess,
}: MonthlyVendorImporterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('upload')
  const [processingMessage, setProcessingMessage] = useState('')
  const [previewData, setPreviewData] = useState<VendorImportPreviewResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get current statement to find the month
  const { data: currentStatement } = api.ownerStatement.getOne.useQuery(
    { id: currentStatementId },
    { enabled: !!currentStatementId }
  )

  // Check for existing vendor expenses when vendor and description are entered
  const { data: existingExpenses } =
    api.ownerStatement.getManyWithDetails.useQuery(
      {
        month: currentStatement?.statementMonth
          ? new Date(currentStatement.statementMonth).toISOString().slice(0, 7)
          : undefined,
      },
      {
        enabled:
          !!currentStatement?.statementMonth &&
          !!vendor.trim() &&
          !!description.trim(),
      }
    )

  // Check if vendor/description combination already exists
  const hasExistingVendorExpenses = existingExpenses?.some((statement) =>
    statement.expenses?.some(
      (expense) =>
        expense.vendor === vendor.trim() &&
        expense.description === description.trim()
    )
  )

  const existingVendorExpenseCount =
    existingExpenses?.reduce((count, statement) => {
      const matchingExpenses =
        statement.expenses?.filter(
          (expense) =>
            expense.vendor === vendor.trim() &&
            expense.description === description.trim()
        ) ?? []
      return count + matchingExpenses.length
    }, 0) ?? 0

  const handleClose = () => {
    setIsOpen(false)
    setVendor('')
    setDescription('')
    setSelectedFile(null)
    setCurrentStep('upload')
    setProcessingMessage('')
    setPreviewData(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Early validation
    if (file.type !== 'application/pdf') {
      ErrorToast('Please select a valid PDF file')
      return
    }

    // File size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      ErrorToast('PDF file is too large. Please select a file smaller than 10MB.')
      return
    }

    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return

    // Early validation
    if (file.type !== 'application/pdf') {
      ErrorToast('Please select a valid PDF file')
      return
    }

    // File size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      ErrorToast('PDF file is too large. Please select a file smaller than 10MB.')
      return
    }

    setSelectedFile(file)
  }

  const handleSubmit = async () => {
    if (!selectedFile || !vendor || !description) {
      ErrorToast('Please fill in all fields and select a PDF file')
      return
    }

    if (hasExistingVendorExpenses) {
      const confirmProceed = window.confirm(
        `Warning: "${vendor}" with description "${description}" already has ${existingVendorExpenseCount} expense(s) for this month. This will create duplicate expenses. Are you sure you want to continue?`
      )
      if (!confirmProceed) {
        return
      }
    }

    // Step 1: Start processing
    setCurrentStep('ai-processing')
    setProcessingMessage('Processing PDF with AI...')

    // Convert file to base64
    const fileResult = await tryCatch(
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(selectedFile)
        reader.onload = () => {
          const base64String = (reader.result as string)?.split(',')[1]
          if (!base64String) {
            reject(new Error('Failed to read file'))
            return
          }
          resolve(base64String)
        }
        reader.onerror = () => reject(new Error('Error reading file'))
      })
    )

    if (fileResult.error) {
      ErrorToast(fileResult.error.message)
      setCurrentStep('upload')
      return
    }

    const base64String = fileResult.data

    // Step 2: Get preview from server
    const result = await tryCatch(
      fetch('/api/vendor-import/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatementId,
          vendor,
          description,
          pdfBase64: base64String,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.text()
          throw new Error(error)
        }
        return response.json()
      })
    )

    if (result.error) {
      ErrorToast(result.error.message || 'Failed to process invoice')
      setCurrentStep('upload')
      return
    }

    const data = result.data as VendorImportPreviewResponse

    if (data.success) {
      setPreviewData(data)
      setCurrentStep('preview')
    } else {
      ErrorToast('Processing failed')
      setCurrentStep('upload')
    }
  }

  const handleConfirm = async () => {
    if (!previewData?.preview.matched.length) {
      ErrorToast('No matched properties to import')
      return
    }

    setCurrentStep('confirming')
    setProcessingMessage('Creating expenses...')

    const result = await tryCatch(
      fetch('/api/vendor-import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatementId,
          approvedMatches: previewData.preview.matched,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const error = await response.text()
          throw new Error(error)
        }
        return response.json()
      })
    )

    if (result.error) {
      ErrorToast(result.error.message || 'Failed to create expenses')
      setCurrentStep('preview')
      return
    }

    const confirmData = result.data as VendorImportConfirmResponse

    if (confirmData.success) {
      SuccessToast(`Successfully created ${confirmData.createdCount} expenses`)
      setCurrentStep('complete')
      handleClose()
      onSuccess?.()
    } else {
      ErrorToast('Failed to create expenses')
      setCurrentStep('preview')
    }
  }

  const isProcessing = ['ai-processing', 'confirming'].includes(currentStep)
  const canClose = !isProcessing

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="text-xs py-1 h-7"
      >
        <FilePlus className="w-3 h-3 mr-1" />
        Import Vendor PDF
      </Button>

      <Dialog 
        open={isOpen} 
        onClose={handleClose}
        size="lg"
      >
        <DialogTitle>Import Vendor Invoice</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className={currentStep === 'upload' ? 'text-primary font-medium' : ''}>
                1. Upload
              </span>
              <span className={currentStep === 'ai-processing' ? 'text-primary font-medium' : ''}>
                2. AI Processing
              </span>
              <span className={currentStep === 'preview' ? 'text-primary font-medium' : ''}>
                3. Preview
              </span>
              <span className={currentStep === 'confirming' ? 'text-primary font-medium' : ''}>
                4. Confirm
              </span>
            </div>

            {/* Upload Step */}
            {currentStep === 'upload' && (
              <>
                <p className="text-sm text-muted-foreground">
                  This will apply the vendor expenses to all properties in the same
                  month.
                </p>

                {/* Vendor Input */}
                <div>
                  <Label htmlFor="vendor">Vendor Name</Label>
                  <Input
                    id="vendor"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g., ABC Cleaning Services"
                    className="mt-1"
                  />
                </div>

                {/* Description Input */}
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Monthly cleaning services"
                    className="mt-1"
                  />
                </div>

                {/* Existing Vendor Warning */}
                {hasExistingVendorExpenses && (
                  <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-3">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-yellow-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Duplicate Vendor Expenses Detected
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>
                            Found {existingVendorExpenseCount} existing expense
                            {existingVendorExpenseCount !== 1 ? 's' : ''} for vendor
                            &quot;{vendor}&quot; with description &quot;
                            {description}&quot; in this month.
                          </p>
                          <p className="mt-1">
                            Consider using a more specific description to avoid duplicates.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div>
                  <Label>Invoice PDF</Label>
                  <div
                    className="mt-1 border-2 border-dashed border-zinc-300 rounded-lg p-4 text-center cursor-pointer hover:bg-zinc-50"
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {selectedFile ? (
                      <div className="text-sm">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Drag and drop or click to select PDF
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Processing Step */}
            {currentStep === 'ai-processing' && (
              <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-blue-800">
                    {processingMessage}
                  </span>
                </div>
                <p className="text-xs text-blue-600">
                  AI is extracting expenses and matching properties. This may take 20-40 seconds.
                </p>
              </div>
            )}

            {/* Preview Step */}
            {currentStep === 'preview' && previewData && (
              <div className="space-y-4">
                <div className="text-sm font-medium">Preview Import Results</div>
                
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-50 rounded-lg text-xs">
                  <div>
                    <div className="font-medium text-green-700">
                      {previewData.preview.summary.totalMatchedProperties} Properties Matched
                    </div>
                    <div className="text-muted-foreground">
                      {previewData.preview.summary.totalMatchedExpenses} expenses • {formatCurrency(previewData.preview.summary.totalMatchedAmount, 'USD', { centsToDollars: false })}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-yellow-700">
                      {previewData.preview.summary.totalUnmatchedProperties} Properties Unmatched
                    </div>
                    <div className="text-muted-foreground">
                      {previewData.preview.summary.totalUnmatchedExpenses} expenses • {formatCurrency(previewData.preview.summary.totalUnmatchedAmount, 'USD', { centsToDollars: false })}
                    </div>
                  </div>
                </div>

                {/* Matched Properties */}
                {previewData.preview.matched.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-green-700 mb-2">
                      ✓ Matched Properties (Will be imported)
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {previewData.preview.matched.map((match, index) => (
                        <div key={index} className="border border-green-200 bg-green-50 rounded p-3">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-medium text-sm">{match.property.name}</div>
                            <div className="text-xs text-green-700 font-medium">
                              {formatCurrency(match.totalAmount, 'USD', { centsToDollars: false })}
                            </div>
                          </div>
                          {match.property.address && (
                            <div className="text-xs text-muted-foreground mb-1">
                              {match.property.address}
                            </div>
                          )}
                          <div className="text-xs text-green-700">
                            {match.expenses.length} expense{match.expenses.length !== 1 ? 's' : ''} • 
                            Confidence: {Math.round(match.confidence * 100)}%
                            {match.reason && ` • ${match.reason}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmatched Properties */}
                {previewData.preview.unmatched.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-yellow-700 mb-2">
                      ⚠ Unmatched Properties (Will be skipped)
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {previewData.preview.unmatched.map((unmatch, index) => (
                        <div key={index} className="border border-yellow-200 bg-yellow-50 rounded p-3">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-medium text-sm">{unmatch.propertyName}</div>
                            <div className="text-xs text-yellow-700 font-medium">
                              {formatCurrency(unmatch.totalAmount, 'USD', { centsToDollars: false })}
                            </div>
                          </div>
                          <div className="text-xs text-yellow-700">
                            {unmatch.expenses.length} expense{unmatch.expenses.length !== 1 ? 's' : ''} • 
                            No matching property found
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirming Step */}
            {currentStep === 'confirming' && (
              <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-green-800">
                    {processingMessage}
                  </span>
                </div>
                <p className="text-xs text-green-600">
                  Creating expenses and updating property statements...
                </p>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={!canClose}
          >
            {currentStep === 'preview' ? 'Cancel' : 'Close'}
          </Button>
          
          {currentStep === 'upload' && (
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={!selectedFile || !vendor || !description}
              className={
                hasExistingVendorExpenses
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : ''
              }
            >
              {hasExistingVendorExpenses ? 'Process Anyway' : 'Process PDF'}
            </Button>
          )}

          {currentStep === 'preview' && (
            <Button
              variant="default"
              onClick={handleConfirm}
              disabled={!previewData?.preview.matched.length}
            >
                             Import {previewData?.preview.summary.totalMatchedExpenses ?? 0} Expenses
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}
