import { FilePlus } from 'lucide-react'
import React, { useRef, useState } from 'react'
import BulkProcessModal from '~/components/owner-statement/BulkProcessModal'
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
  const [error, setError] = useState<string | null>(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkProcessInput, setBulkProcessInput] = useState<{
    currentStatementId: string
    vendor: string
    description: string
    pdfBase64: string
  } | null>(null)
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
          ? new Date(currentStatement.statementMonth).toISOString().slice(0, 7) // YYYY-MM format
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

  // Apply vendor expenses mutation
  const applyVendorMutation =
    api.ownerStatement.applyMonthlyVendorExpenses.useMutation({
      onSuccess: (data) => {
        SuccessToast(
          `Applied expenses to ${data.updatedCount} properties in this month`
        )
        handleClose()
        onSuccess?.()
      },
      onError: (error) => {
        // Check if this is a redirect to streaming API
        if (error.message === 'REDIRECT_TO_STREAMING') {
          // Don't show error toast, just trigger the bulk process modal
          return
        }

        ErrorToast(error.message || 'Failed to apply vendor expenses')
        setError(error.message || 'Failed to apply vendor expenses')
      },
    })

  const handleClose = () => {
    setIsOpen(false)
    setVendor('')
    setDescription('')
    setSelectedFile(null)
    setError(null)
  }

  const handleBulkModalClose = () => {
    setShowBulkModal(false)
    setBulkProcessInput(null)
    handleClose() // Also close the main modal
  }

  const handleBulkProcessComplete = (result: {
    updatedCount: number
    updatedProperties: string[]
  }) => {
    SuccessToast(
      `Applied expenses to ${result.updatedCount} properties in this month`
    )
    setShowBulkModal(false)
    setBulkProcessInput(null)
    handleClose()
    onSuccess?.()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setError(null)
    } else {
      setError('Please select a valid PDF file')
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setError(null)
    } else {
      setError('Please select a valid PDF file')
    }
  }

  const handleSubmit = () => {
    if (!selectedFile || !vendor || !description) {
      setError('Please fill in all fields and select a PDF file')
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

    const reader = new FileReader()
    reader.readAsDataURL(selectedFile)
    reader.onload = () => {
      const base64String = (reader.result as string)?.split(',')[1]
      if (base64String) {
        // First try the regular tRPC mutation
        applyVendorMutation.mutate(
          {
            currentStatementId,
            vendor,
            description,
            pdfBase64: base64String,
          },
          {
            onError: (error) => {
              // Check if this is a redirect to streaming API
              if (error.message === 'REDIRECT_TO_STREAMING') {
                // Set up bulk process modal
                setBulkProcessInput({
                  currentStatementId,
                  vendor,
                  description,
                  pdfBase64: base64String,
                })
                setShowBulkModal(true)
                return
              }

              // Handle other errors normally
              ErrorToast(error.message || 'Failed to apply vendor expenses')
              setError(error.message || 'Failed to apply vendor expenses')
            },
          }
        )
      } else {
        setError('Failed to read file')
      }
    }
    reader.onerror = () => {
      setError('Error reading file')
    }
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
                        Consider using a more specific description (e.g., add
                        date or invoice number) to avoid duplicates.
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

            {/* Error Message */}
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        </DialogBody>
        <DialogActions>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={applyVendorMutation.isPending}
            className={
              hasExistingVendorExpenses
                ? 'bg-yellow-600 hover:bg-yellow-700'
                : ''
            }
          >
            {applyVendorMutation.isPending
              ? 'Processing...'
              : hasExistingVendorExpenses
                ? 'Import Anyway'
                : 'Apply to Month'}
          </Button>
        </DialogActions>
      </Dialog>

      <BulkProcessModal
        open={showBulkModal}
        onClose={handleBulkModalClose}
        onComplete={handleBulkProcessComplete}
        input={bulkProcessInput}
      />
    </>
  )
}
