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
import { tryCatch } from '~/lib/utils/try-catch'
import { api } from '~/trpc/react'

interface MonthlyVendorImporterProps {
  currentStatementId: string
  onSuccess?: () => void
}

export default function MonthlyVendorImporter({
  currentStatementId,
  onSuccess,
}: MonthlyVendorImporterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState('')
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
    setIsProcessing(false)
    setProcessingMessage('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
    } else {
      ErrorToast('Please select a valid PDF file')
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
    } else {
      ErrorToast('Please select a valid PDF file')
    }
  }

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 60 // 5 minutes max
    let attempts = 0

    const poll = async (): Promise<void> => {
      const result = await tryCatch(
        fetch(`/api/vendor-import/status/${jobId}`).then((res) => res.json())
      )

      if (result.error) {
        ErrorToast('Failed to check processing status')
        setIsProcessing(false)
        return
      }

      const statusData = result.data as { status: string; result?: { message?: string }; error?: string }

      if (statusData.status === 'completed') {
        SuccessToast(statusData.result?.message ?? 'Processing completed')
        handleClose()
        onSuccess?.()
        return
      }

      if (statusData.status === 'failed') {
        ErrorToast(statusData.error ?? 'Processing failed')
        setIsProcessing(false)
        return
      }

      // Still processing
      attempts++
      if (attempts >= maxAttempts) {
        ErrorToast('Processing timed out. Please try again.')
        setIsProcessing(false)
        return
      }

      setProcessingMessage(`Processing... (${attempts * 5}s)`)
      setTimeout(() => void poll(), 5000) // Poll every 5 seconds
    }

    await poll()
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

    setIsProcessing(true)
    setProcessingMessage('Starting processing...')

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
      setIsProcessing(false)
      return
    }

    const base64String = fileResult.data

    // Start the job
    const result = await tryCatch(
      fetch('/api/vendor-import', {
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
      ErrorToast(result.error.message || 'Failed to start processing')
      setIsProcessing(false)
      return
    }

    const { jobId } = result.data as { jobId: string }
    setProcessingMessage('Processing with AI...')
    
    // Start polling for status
    await pollJobStatus(jobId)
  }

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

      <Dialog open={isOpen} onClose={handleClose} size="md">
        <DialogTitle>Import Vendor Invoice</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
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
                disabled={isProcessing}
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
                disabled={isProcessing}
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
                onClick={() => !isProcessing && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
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

            {/* Processing Status */}
            {isProcessing && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-blue-800">
                    {processingMessage}
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  This may take 30-60 seconds. Please don&apos;t close this window.
                </p>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={isProcessing || !selectedFile || !vendor || !description}
            className={
              hasExistingVendorExpenses
                ? 'bg-yellow-600 hover:bg-yellow-700'
                : ''
            }
          >
            {isProcessing
              ? 'Processing...'
              : hasExistingVendorExpenses
                ? 'Import Anyway'
                : 'Start Processing'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
