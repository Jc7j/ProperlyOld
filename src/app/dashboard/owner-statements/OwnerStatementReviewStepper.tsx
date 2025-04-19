import { AlertTriangle, CheckCircle, Dot, FilePlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
  Input,
  Label,
} from '~/components/ui'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import { api } from '~/trpc/react'

import OwnerStatementReviewTable from './OwnerStatementReviewTable'

// Define type for the expected map from the backend
// This map now only contains date and amount from Gemini
type ExtractedExpensesMapType = Record<
  string,
  Array<{
    date: string
    amount: number
  }>
>

export default function OwnerStatementReviewStepper({
  drafts,
  unmatchedListings,
  onDone,
}: {
  drafts: any[]
  unmatchedListings: string[]
  onDone: () => void
}) {
  // Sort drafts A-Z by propertyName on mount
  const [orderedDrafts, setOrderedDrafts] = useState<any[]>([])
  const [step, setStep] = useState(0)
  // Track which drafts have been created (reviewed)
  const [created, setCreated] = useState<boolean[]>([])

  // State for invoice parsing
  const [isParsingInvoice, setIsParsingInvoice] = useState(false)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null) // Ref for hidden file input

  // State for the Invoice Dialog
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false)
  const [dialogVendor, setDialogVendor] = useState('')
  const [dialogDescription, setDialogDescription] = useState('')
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)

  useEffect(() => {
    const sorted = [...drafts].sort((a, b) =>
      a.propertyName.localeCompare(b.propertyName)
    )
    setOrderedDrafts(sorted)
    setCreated(new Array(sorted.length).fill(false))
    setStep(0)
  }, [drafts])

  const current = orderedDrafts[step] || {}

  // Progress list for sidebar
  const progressList = useMemo(
    () =>
      orderedDrafts.map((d, idx) => ({
        propertyName: d.propertyName,
        reviewed: created[idx],
        isCurrent: idx === step,
      })),
    [orderedDrafts, created, step]
  )

  // Handle marking as created (simulate backend creation)
  const handleNext = () => {
    if (step === orderedDrafts.length - 1) onDone()
    else setStep((s) => s + 1)
  }

  // Progress bar calculation
  const reviewedCount = created.filter(Boolean).length
  const totalCount = created.length
  const progressPercent = totalCount
    ? Math.round((reviewedCount / totalCount) * 100)
    : 0

  // *** Update FUNCTION to apply extracted expenses map ***
  const applyExtractedExpenses = (
    expensesMap: ExtractedExpensesMapType,
    vendor: string,
    description: string
  ) => {
    let updatedCount = 0
    setOrderedDrafts((currentDrafts) => {
      const newDrafts = [...currentDrafts]

      Object.entries(expensesMap).forEach(
        ([propertyNameFromMap, expensesToAdd]) => {
          const draftIndex = newDrafts.findIndex((draft) => {
            const draftNameNorm = draft.propertyName.trim().toLowerCase()
            const mapKeyNorm = propertyNameFromMap.trim().toLowerCase()
            const isMatch = draftNameNorm === mapKeyNorm
            return isMatch
          })

          if (draftIndex !== -1 && expensesToAdd.length > 0) {
            updatedCount++
            const targetDraft = { ...newDrafts[draftIndex] }
            targetDraft.expenses = targetDraft.expenses
              ? [...targetDraft.expenses]
              : []

            expensesToAdd.forEach((expense) => {
              targetDraft.expenses.push({
                date: expense.date,
                description: description,
                vendor: vendor,
                amount: expense.amount,
              })
            })

            newDrafts[draftIndex] = targetDraft
          }
        }
      )

      return updatedCount > 0 ? newDrafts : currentDrafts
    })

    if (updatedCount > 0) {
      setInvoiceError(null)
    } else {
      setInvoiceError(
        'Invoice processed, but no matching property statements currently being reviewed were found for the extracted expenses.'
      )
    }
  }

  // Right Panel: Review Table
  const handleDraftChange = (
    idx: number,
    section: string,
    rowIdx: number,
    key: string,
    value: any
  ) => {
    setOrderedDrafts((drafts) => {
      const newDrafts = [...drafts]
      const draft = { ...newDrafts[idx] }
      if (section === 'notes') {
        draft.notes = value
      } else if (key === '__delete') {
        const arr = [...draft[section]]
        arr.splice(rowIdx, 1)
        draft[section] = arr
      } else if (key === '__add') {
        draft[section] = [...draft[section], value]
      } else {
        const arr = [...draft[section]]
        arr[rowIdx] = { ...arr[rowIdx], [key]: value }
        draft[section] = arr
      }
      newDrafts[idx] = draft
      return newDrafts
    })
  }

  // tRPC Mutation Hook (Define callbacks here)
  const parseInvoiceMutation =
    api.ownerStatement.parseInvoiceExpenseWithGemini.useMutation({
      onSuccess: (extractedExpensesMap, variables) => {
        if (
          extractedExpensesMap &&
          Object.keys(extractedExpensesMap).length > 0
        ) {
          applyExtractedExpenses(
            extractedExpensesMap,
            variables.vendor,
            variables.description
          )
          SuccessToast('Invoice expenses imported successfully.')
        }
        setIsParsingInvoice(false)
        setIsInvoiceDialogOpen(false)
      },
      onError: (error) => {
        console.error('Invoice parsing error:', error)
        setInvoiceError(
          error.message || `Invoice import failed: An unknown error occurred.`
        )
        setIsParsingInvoice(false)
      },
    })

  // *** Add Create Mutation Hook ***
  const createMutation = api.ownerStatement.create.useMutation({
    onSuccess: (_data) => {
      SuccessToast(`Statement for ${current.propertyName} created!`)
      // Mark as created on success
      setCreated((arr) => {
        const next = [...arr]
        next[step] = true
        return next
      })
    },
    onError: (error) => {
      console.error('Statement creation error:', error)
      ErrorToast(
        `Failed to create statement: ${error.message ?? 'Unknown error'}`
      )
      // Potentially add specific error state if needed
    },
  })

  // Function to handle creating the statement via API
  const handleCreateStatement = () => {
    if (!current?.propertyId) {
      ErrorToast('Cannot create statement: Missing property data.')
      return
    }

    // --- Data Preparation ---
    // Convert YYYY-MM string to Date object (first day of month)
    // Assuming current.statementMonth is 'YYYY-MM' format
    const [year, month] = (current.statementMonth || '').split('-')
    let statementMonthDate: Date | null = null
    if (year && month) {
      statementMonthDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    }

    if (!statementMonthDate) {
      ErrorToast('Invalid statement month format.')
      return
    }

    // Ensure incomes, expenses, adjustments are arrays (even if empty)
    const incomes = Array.isArray(current.incomes) ? current.incomes : []
    const expenses = Array.isArray(current.expenses) ? current.expenses : []
    const adjustments = Array.isArray(current.adjustments)
      ? current.adjustments
      : []

    // --- Input Validation (Basic) ---
    if (incomes.length === 0) {
      ErrorToast(
        'Cannot create statement: At least one income item is required.'
      )
      return
    }
    // Add more validation if needed for specific fields within incomes/expenses/adjustments

    createMutation.mutate({
      propertyId: current.propertyId,
      statementMonth: statementMonthDate,
      notes: current.notes ?? '',
      incomes: incomes, // Pass prepared incomes
      expenses: expenses, // Pass prepared expenses
      adjustments: adjustments, // Pass prepared adjustments
    })
  }

  // Function to handle submission from the Dialog
  const handleProcessInvoice = () => {
    if (!selectedPdfFile || !dialogVendor || !dialogDescription) {
      setInvoiceError('Missing vendor, description, or file.')
      return
    }

    const draftNames = orderedDrafts.map((d) => d.propertyName)
    if (draftNames.length === 0) {
      setInvoiceError('No drafts available to match expenses against.')
      return
    }

    setIsParsingInvoice(true)
    setInvoiceError(null)
    const capturedVendor = dialogVendor
    const capturedDescription = dialogDescription

    const reader = new FileReader()
    reader.readAsDataURL(selectedPdfFile)
    reader.onload = () => {
      const base64String = (reader.result as string)?.split(',')[1]
      if (base64String) {
        parseInvoiceMutation.mutate({
          pdfBase64: base64String,
          draftPropertyNames: draftNames,
          vendor: capturedVendor,
          description: capturedDescription,
        })
      } else {
        setInvoiceError('Could not read the file content.')
        setIsParsingInvoice(false)
      }
    }
    reader.onerror = (error) => {
      console.error('File reading error:', error)
      setInvoiceError('Error reading file.')
      setIsParsingInvoice(false)
    }
  }

  // Function to handle closing the dialog and resetting its state
  const closeInvoiceDialog = () => {
    setIsInvoiceDialogOpen(false)
    setDialogVendor('')
    setDialogDescription('')
    setSelectedPdfFile(null)
    setInvoiceError(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-900 flex flex-col min-h-screen px-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="text-lg font-bold">
          Review Owner Statements ({step + 1} of {orderedDrafts.length})
        </div>
        <Button outline onClick={onDone}>
          Exit Review
        </Button>
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row items-stretch justify-center overflow-y-auto py-8 gap-8">
        {/* Left Sidebar */}
        <div className="w-full md:w-1/4 max-w-xs mx-auto md:mx-0 mb-8 md:mb-0 flex flex-col gap-6">
          {/* Add Invoice Button (Update disabled logic) */}
          <Button
            outline
            onClick={() => setIsInvoiceDialogOpen(true)}
            className="w-full"
          >
            {isParsingInvoice ? (
              'Processing Invoice...'
            ) : (
              <>
                <FilePlus className="w-4 h-4 mr-2" />
                Import a vendor invoice
              </>
            )}
          </Button>
          {/* Display Error Message */}
          {invoiceError && (
            <Card className="p-3 mb-4 border-red-300 bg-red-100 text-red-800 text-xs">
              {invoiceError}
            </Card>
          )}
          {/* Progress Card */}
          <Card className="p-4">
            <div className="font-semibold mb-2 text-sm">Review Progress</div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-green-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500 min-w-[48px] text-right">
                {reviewedCount}/{totalCount}
              </span>
            </div>
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {progressList.map((item, idx) => (
                <li
                  key={item.propertyName}
                  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors
                    ${item.isCurrent ? 'bg-primary/10 font-bold text-primary' : ''}
                    ${item.reviewed ? 'opacity-70' : ''}
                  `}
                  onClick={() => setStep(idx)}
                >
                  {item.reviewed ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  ) : item.isCurrent ? (
                    <Dot className="w-5 h-5 text-blue-500 shrink-0" />
                  ) : (
                    <Dot className="w-5 h-5 text-zinc-400 shrink-0" />
                  )}
                  <span className="truncate flex-1">{item.propertyName}</span>
                </li>
              ))}
            </ul>
          </Card>
          {/* Unmatched Listings Card */}
          <Card className="p-4 bg-yellow-50 border border-yellow-200">
            <div className="flex items-center gap-2 mb-2 text-yellow-800 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4" />
              Unmatched Listings
            </div>
            {unmatchedListings.length === 0 ? (
              <div className="text-xs text-zinc-500">None</div>
            ) : (
              <ul className="text-xs text-yellow-800 space-y-1 max-h-32 overflow-y-auto">
                {unmatchedListings.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        {/* Right Panel: Review Table */}
        <div className="flex-1 flex flex-col items-center">
          <OwnerStatementReviewTable
            statementDraft={current}
            onChange={(section, rowIdx, key, value) =>
              handleDraftChange(step, section, rowIdx, key, value)
            }
          />
          <div className="flex justify-end gap-2 mt-8 w-full max-w-3xl">
            <Button
              outline
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              Previous
            </Button>
            <Button
              color="secondary"
              onClick={handleCreateStatement}
              disabled={created[step] ?? createMutation.isPending}
            >
              {createMutation.isPending
                ? 'Creating...'
                : created[step]
                  ? 'Created'
                  : 'Create Statement'}
            </Button>
            <Button color="primary-solid" onClick={handleNext}>
              {step === orderedDrafts.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Import Dialog */}
      <Dialog open={isInvoiceDialogOpen} onClose={closeInvoiceDialog} size="lg">
        <DialogTitle>Import Vendor Invoice Expenses</DialogTitle>
        <DialogBody className="space-y-4">
          {invoiceError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Error: {invoiceError}
            </p>
          )}
          <div>
            <Label htmlFor="dialogVendor">Vendor Name</Label>
            <Input
              id="dialogVendor"
              value={dialogVendor}
              onChange={(e) => setDialogVendor(e.target.value)}
              placeholder="Enter vendor name..."
              disabled={isParsingInvoice}
            />
          </div>
          <div>
            <Label htmlFor="dialogDesc">Expense Description</Label>
            <Input
              id="dialogDesc"
              value={dialogDescription}
              onChange={(e) => setDialogDescription(e.target.value)}
              placeholder="Enter description (e.g., Pool Service May)"
              disabled={isParsingInvoice}
            />
          </div>
          <div>
            <Label htmlFor="pdfFile">Invoice PDF</Label>
            <div
              className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-zinc-300 dark:border-zinc-700 border-dashed rounded-md cursor-pointer hover:border-primary/50 dark:hover:border-primary/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="space-y-1 text-center">
                <div className="flex text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="relative rounded-md font-medium text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary hover:text-primary/80">
                    Upload a file
                  </span>
                  <input
                    id="pdfFile"
                    ref={fileInputRef}
                    name="pdfFile"
                    type="file"
                    className="sr-only"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && file.type === 'application/pdf') {
                        setSelectedPdfFile(file)
                        setInvoiceError(null)
                      } else {
                        setSelectedPdfFile(null)
                        if (file)
                          setInvoiceError(
                            'Invalid file type. Please select a PDF.'
                          )
                      }
                      e.target.value = ''
                    }}
                    disabled={isParsingInvoice}
                  />
                </div>
                {selectedPdfFile ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Selected: {selectedPdfFile.name}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    PDF only, up to X MB
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            outline
            onClick={closeInvoiceDialog}
            disabled={isParsingInvoice}
          >
            Cancel
          </Button>
          <Button
            color="primary-solid"
            onClick={handleProcessInvoice}
            disabled={
              !dialogVendor ||
              !dialogDescription ||
              !selectedPdfFile ||
              isParsingInvoice
            }
          >
            {isParsingInvoice ? 'Processing...' : 'Process Invoice'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
