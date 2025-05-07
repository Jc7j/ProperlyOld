import { AlertTriangle, CheckCircle, Dot, FilePlus, Info } from 'lucide-react'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
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
  const [orderedDrafts, setOrderedDrafts] = useState<any[]>([])
  const [step, setStep] = useState(0)
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

  // NEW state for parsed invoice results
  const [parsedInvoiceProperties, setParsedInvoiceProperties] = useState<
    string[] | null
  >(null)
  const [parsingResultMessage, setParsingResultMessage] = useState<
    string | null
  >(null)

  useEffect(() => {
    const sorted = [...drafts].sort((a, b) =>
      a.propertyName.localeCompare(b.propertyName)
    )
    setOrderedDrafts(sorted)
    setCreated(new Array(sorted.length).fill(false))
    setStep(0)
    // Reset parsing results when drafts change
    setParsedInvoiceProperties(null)
    setParsingResultMessage(null)
  }, [drafts]) // Only depends on drafts now

  const current = orderedDrafts[step] || {}

  // Progress list for sidebar
  const progressList = useMemo(
    () =>
      orderedDrafts.map((d, idx) => ({
        propertyName: d.propertyName,
        reviewed: created[idx],
        isCurrent: idx === step,
        hasExistingStatement: d.hasExistingStatement ?? false,
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

  const applyExtractedExpenses = (
    expensesMap: ExtractedExpensesMapType,
    vendor: string,
    description: string
  ): { updatedCount: number; unmatchedNames: string[] } => {
    let finalUpdatedCount = 0
    const finalUnmatchedNames: string[] = []

    setOrderedDrafts((currentDrafts) => {
      let updatedCount = 0
      const unmatchedNamesForThisUpdate = new Set<string>()
      const newDrafts = [...currentDrafts]
      let changesMade = false

      Object.entries(expensesMap).forEach(
        ([propertyNameFromMap, expensesToAdd]) => {
          const draftIndex = newDrafts.findIndex((draft) => {
            // Normalize for comparison
            const draftNameNorm = draft.propertyName?.trim().toLowerCase()
            const mapKeyNorm = propertyNameFromMap?.trim().toLowerCase()
            // Basic direct match
            if (draftNameNorm && mapKeyNorm && draftNameNorm === mapKeyNorm) {
              return true
            }
            // Add more sophisticated matching if needed (e.g., fuzzy)
            return false
          })

          if (draftIndex !== -1 && expensesToAdd.length > 0) {
            updatedCount++
            changesMade = true
            const targetDraft = { ...newDrafts[draftIndex] }
            targetDraft.expenses = targetDraft.expenses
              ? [...targetDraft.expenses]
              : []

            expensesToAdd.forEach((expense) => {
              targetDraft.expenses.push({
                date: expense.date, // Use extracted date
                description: description, // Use dialog description
                vendor: vendor, // Use dialog vendor
                amount: expense.amount, // Use extracted amount
              })
            })

            newDrafts[draftIndex] = targetDraft
          } else {
            // If no match found or expensesToAdd is empty, mark as unmatched
            unmatchedNamesForThisUpdate.add(propertyNameFromMap)
          }
        }
      )

      finalUpdatedCount = updatedCount
      unmatchedNamesForThisUpdate.forEach((name) =>
        finalUnmatchedNames.push(name)
      ) // Add to final list after loop

      return changesMade ? newDrafts : currentDrafts
    })

    return {
      updatedCount: finalUpdatedCount,
      unmatchedNames: finalUnmatchedNames,
    }
  }

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

  const parseInvoiceMutation =
    api.ownerStatement.parseInvoiceExpenseWithGemini.useMutation({
      onSuccess: (extractedExpensesMap, variables) => {
        // Reset previous results/errors first
        setInvoiceError(null)
        setParsedInvoiceProperties(null)
        setParsingResultMessage(null)

        if (
          extractedExpensesMap &&
          Object.keys(extractedExpensesMap).length > 0
        ) {
          const propertyNamesFound = Object.keys(extractedExpensesMap)
          setParsedInvoiceProperties(propertyNamesFound)

          // Call applyExtractedExpenses to update drafts in the background
          // The UI feedback no longer depends directly on its return value.
          applyExtractedExpenses(
            extractedExpensesMap,
            variables.vendor,
            variables.description
          )

          // Construct the simplified informative message
          const message = `Parsed expenses for the properties listed below. Please review and verify against the invoice.`
          setParsingResultMessage(message)

          // Optionally, show a simple success toast for the *action* completion
          SuccessToast('Invoice processed.')
        } else {
          // Handle case where Gemini might return an empty map or structured incorrectly
          setParsingResultMessage(
            'Could not extract relevant expense data from the invoice.'
          )
          // Ensure properties list is cleared
          setParsedInvoiceProperties(null)
        }
        setIsParsingInvoice(false)
        setIsInvoiceDialogOpen(false) // Close dialog on success/handled info
      },
      onError: (error) => {
        console.error('Invoice parsing error:', error)
        // Use invoiceError state for actual failures
        setInvoiceError(
          error.message || `Invoice import failed: An unknown error occurred.`
        )
        // Clear any previous successful parse message
        setParsingResultMessage(null)
        setParsedInvoiceProperties(null)
        setIsParsingInvoice(false)
        // Keep dialog open on error? Or close? Let's close it for now.
        // setIsInvoiceDialogOpen(false);
      },
    })

  const { mutate: createMutation, isPending: isCreating } =
    api.ownerStatement.create.useMutation({
      onMutate: async () => {
        // Capture context at the time of mutation
        return {
          originalStepIndex: step,
          propertyNameForToast: current.propertyName,
        }
      },
      onSuccess: (data, variables, context) => {
        SuccessToast(
          `Statement for ${context?.propertyNameForToast ?? 'selected property'} created!`
        )
        setCreated((arr) => {
          const next = [...arr]
          if (context?.originalStepIndex !== undefined) {
            next[context.originalStepIndex] = true
          }
          return next
        })
      },
      onError: (error, variables, context) => {
        console.error('Statement creation error:', error)
        ErrorToast(
          `Failed to create statement for ${context?.propertyNameForToast ?? 'selected property'}: ${error.message ?? 'Unknown error'}`
        )
      },
    })

  const handleCreateStatement = () => {
    const draftToProcess = current // Use current draft from component state

    if (!draftToProcess?.propertyId) {
      ErrorToast('Cannot create statement: Missing property data.')
      return
    }

    let statementMonthDate: Date | null = null
    if (draftToProcess.statementMonth instanceof Date) {
      statementMonthDate = draftToProcess.statementMonth
    } else if (typeof draftToProcess.statementMonth === 'string') {
      const parts = draftToProcess.statementMonth.split('-')
      if (parts.length === 2) {
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10)
        if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
          statementMonthDate = new Date(year, month - 1, 1)
        }
      }
    }

    if (!statementMonthDate || isNaN(statementMonthDate?.getTime())) {
      console.error('Invalid statement month:', draftToProcess.statementMonth)
      ErrorToast('Invalid or missing statement month data.')
      return
    }

    const incomes = Array.isArray(draftToProcess.incomes)
      ? draftToProcess.incomes
      : []
    const expenses = Array.isArray(draftToProcess.expenses)
      ? draftToProcess.expenses
      : []
    const adjustments = Array.isArray(draftToProcess.adjustments)
      ? draftToProcess.adjustments
      : []

    if (incomes.length === 0) {
      ErrorToast(
        'Cannot create statement: At least one income item is required.'
      )
      return
    }

    const totalIncome = incomes.reduce((sum: number, i: any) => {
      const income = Number(i.grossIncome) || 0
      return parseFloat((sum + income).toFixed(2))
    }, 0)

    const totalExpenses = expenses.reduce((sum: number, e: any) => {
      const expense = Number(e.amount) || 0
      return parseFloat((sum + expense).toFixed(2))
    }, 0)

    const totalAdjustments = adjustments.reduce((sum: number, a: any) => {
      const adjustment = Number(a.amount) || 0
      return parseFloat((sum + adjustment).toFixed(2))
    }, 0)

    const grandTotal = parseFloat(
      (totalIncome - totalExpenses + totalAdjustments).toFixed(2)
    )

    createMutation({
      propertyId: draftToProcess.propertyId,
      statementMonth: statementMonthDate,
      notes: draftToProcess.notes ?? '',
      incomes: incomes,
      expenses: expenses,
      adjustments: adjustments,
      totalIncome,
      totalExpenses,
      totalAdjustments,
      grandTotal,
    })
  }

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
    // Don't clear parsingResultMessage/parsedInvoiceProperties here
    // Let them persist until the next parse or component update
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col min-h-screen">
      {/* Top Bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="text-lg font-semibold">
          Review Owner Statements ({step + 1} of {orderedDrafts.length})
        </div>
        <Button variant="outline" onClick={onDone}>
          Exit Review
        </Button>
      </div>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-6 overflow-y-auto flex flex-col gap-6">
          {/* Add Invoice Button */}
          <Button
            variant="outline"
            onClick={() => setIsInvoiceDialogOpen(true)}
            className="w-full"
            disabled={isParsingInvoice}
          >
            {isParsingInvoice ? (
              'Processing Invoice...'
            ) : (
              <>
                <FilePlus className="w-4 h-4 mr-2" />
                Import Vendor PDF
              </>
            )}
          </Button>
          {/* Display GENUINE Error Message */}
          {invoiceError && !parsingResultMessage && (
            <Card className="p-4 border-red-300 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 mt-0.5 text-red-600" />
                <div>
                  <div className="font-medium mb-1">Import Error</div>
                  {invoiceError}
                </div>
              </div>
            </Card>
          )}
          {/* NEW Parsed Invoice Details Card */}
          {parsingResultMessage && (
            <Card className="p-4 max-h-72 overflow-y-auto border-blue-300 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="font-semibold mb-1">
                    Parsed Invoice Details
                  </div>
                  <p>{parsingResultMessage}</p>
                  {/* Display parsed properties as a list */}
                  {parsedInvoiceProperties &&
                    parsedInvoiceProperties.length > 0 && (
                      <ul className="mt-2 list-disc list-inside text-xs space-y-1">
                        {parsedInvoiceProperties.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                </div>
              </div>
            </Card>
          )}
          {/* Progress Card */}
          <Card className="p-5 bg-white dark:bg-zinc-800/60 shadow-sm">
            <div className="font-semibold mb-3 text-base">Review Progress</div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-green-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400 min-w-[50px] text-right">
                {reviewedCount}/{totalCount}
              </span>
            </div>
            {/* Progress List - Enhanced Styling */}
            <ul className="space-y-1.5 max-h-72 overflow-y-auto -mr-2 pr-2">
              {progressList.map((item, idx) => (
                <li
                  key={item.propertyName}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors duration-150 ease-in-out
                    ${item.isCurrent ? 'bg-primary/10 text-primary font-semibold' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'}
                    ${item.reviewed ? 'opacity-60 hover:opacity-100' : ''}
                  `}
                  onClick={() => setStep(idx)}
                  aria-current={item.isCurrent ? 'step' : undefined}
                >
                  {item.reviewed ? (
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  ) : item.isCurrent ? (
                    <Dot className="w-6 h-6 text-primary shrink-0 -ml-1" />
                  ) : (
                    // Default icon if not created and not current
                    <span className="w-5 h-5 flex items-center justify-center shrink-0">
                      <Dot className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
                    </span>
                  )}
                  <span className="truncate flex-1 text-sm">
                    {item.propertyName}
                  </span>
                  {item.hasExistingStatement && !item.reviewed && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 ml-auto" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          An owner statement for this property and month already
                          exists.
                        </p>
                        <p>Proceeding will create an additional statement.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {/* Unmatched Listings Card */}
          {unmatchedListings.length > 0 && (
            <Card className="p-5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 shadow-sm">
              <div className="flex flex-col  gap-2 mb-3 text-yellow-800 dark:text-yellow-200 font-semibold text-base">
                <AlertTriangle className="w-5 h-5" />
                Unmatched Listings
                <p className="text-xs mb-2 font-normal">
                  Properties from imported data that couldn&apos;t be matched
                  with existing property names in the system.
                </p>
              </div>
              <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1.5 max-h-40 overflow-y-auto pl-1 -mr-2 pr-2">
                {unmatchedListings.map((l, i) => (
                  <li key={i} className="truncate">
                    {l}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
        {/* Right Panel: Review Table Area */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8">
          <div className="w-full max-w-6xl mx-auto">
            <OwnerStatementReviewTable
              statementDraft={current}
              onChange={(section, rowIdx, key, value) =>
                handleDraftChange(step, section, rowIdx, key, value)
              }
            />
            {/* Action Buttons - Centered on mobile, right-aligned on md+ */}
            <div className="flex flex-col sm:flex-row justify-center sm:justify-end gap-3 mt-8 w-full">
              <Button
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
                className="w-full sm:w-auto"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={handleCreateStatement}
                disabled={created[step] ?? isCreating}
                className="w-full sm:w-auto"
              >
                {isCreating
                  ? 'Creating...'
                  : created[step]
                    ? 'Statement Created'
                    : 'Create Statement'}
              </Button>
              <Button
                variant="default"
                onClick={handleNext}
                disabled={isCreating}
                className="w-full sm:w-auto"
              >
                {step === orderedDrafts.length - 1
                  ? 'Finish Review'
                  : 'Next Statement'}
              </Button>
            </div>
            {/* Add informational text */}
            <p className="text-center sm:text-right text-sm text-zinc-600 dark:text-zinc-400 mt-4 italic">
              Statements can be edited after they have been created.
            </p>
          </div>
        </main>
      </div>

      {/* Invoice Import Dialog */}
      <Dialog open={isInvoiceDialogOpen} onClose={closeInvoiceDialog} size="lg">
        <DialogTitle>Import Vendor Invoice Expenses</DialogTitle>
        <DialogBody className="space-y-4">
          {/* This error is for dialog validation or file reading issues, not post-parse */}
          {invoiceError &&
            !parsingResultMessage && ( // Only show if not overridden by parse result message
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
                      // Clear the input value to allow re-selecting the same file
                      if (e.target) e.target.value = ''
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
                    PDF only
                  </p> // Simplified placeholder
                )}
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            variant="outline"
            onClick={closeInvoiceDialog}
            disabled={isParsingInvoice}
          >
            Cancel
          </Button>
          <Button
            variant="default"
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
