import { FileSpreadsheet } from 'lucide-react'
import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
  Label,
} from '~/components/ui'
import { SuccessToast, ErrorToast } from '~/components/ui/sonner'
import type {
  VendorImportPreviewResponse,
  VendorImportConfirmResponse,
} from '~/lib/OwnerStatement/vendor-import'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

interface VendorExcelImporterProps {
  currentStatementId: string
  onSuccess?: () => void
}

interface ExcelExpense {
  property: string
  date: string
  description: string
  vendor: string
  amount: number
}

type ProcessingStep = 'upload' | 'processing' | 'preview' | 'confirming' | 'complete'

// Utility functions for Excel parsing
const parseExcelCell = (cell: unknown): string => {
  if (cell == null) return ''
  if (typeof cell === 'string') return cell.trim()
  if (typeof cell === 'number') return cell.toString()
  if (typeof cell === 'boolean') return cell.toString()
  if (cell instanceof Date) return cell.toISOString().split('T')[0] ?? ''
  // Handle objects by trying JSON.stringify first
  if (typeof cell === 'object') {
    try {
      return JSON.stringify(cell)
    } catch {
      return '[object Object]'
    }
  }
  // For any remaining primitive types (symbol, bigint, etc.), return empty string
  return ''
}

const validateHeaders = (headers: string[]): string[] => {
  const required = ['property', 'date', 'description', 'vendor', 'amount']
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim())

  return required.filter(
    (col) => !normalizedHeaders.some((h) => h.includes(col))
  )
}

const parseExpenseRow = (
  row: unknown[],
  columnIndices: Record<string, number>,
  rowIndex: number
): { expense?: ExcelExpense; error?: string } => {
  if (!row || !Array.isArray(row) || row.every((cell) => !cell)) {
    return {}
  }

  const property = parseExcelCell(row[columnIndices.property!])
  const date = parseExcelCell(row[columnIndices.date!])
  const description = parseExcelCell(row[columnIndices.description!])
  const vendor = parseExcelCell(row[columnIndices.vendor!])
  const amountStr = parseExcelCell(row[columnIndices.amount!])

  // Validate required fields
  if (!property || !date || !description || !vendor || !amountStr) {
    return { error: `Row ${rowIndex}: Missing required information` }
  }

  // Parse amount with improved logic
  let cleanAmountStr = amountStr.trim()
  
  // Remove currency symbols and spaces
  cleanAmountStr = cleanAmountStr.replace(/[$£€¥₹,\s]/g, '')
  
  // Handle parentheses for negative amounts (accounting format)
  if (cleanAmountStr.startsWith('(') && cleanAmountStr.endsWith(')')) {
    cleanAmountStr = '-' + cleanAmountStr.slice(1, -1)
  }
  
  // Ensure only one decimal point and one negative sign
  const decimalCount = (cleanAmountStr.match(/\./g) ?? []).length
  const negativeCount = (cleanAmountStr.match(/-/g) ?? []).length
  
  if (decimalCount > 1 || negativeCount > 1) {
    return { error: `Row ${rowIndex}: Invalid amount format "${amountStr}"` }
  }
  
  // Final validation - should only contain digits, one decimal point, and/or one negative sign
  if (!/^-?\d*\.?\d*$/.test(cleanAmountStr)) {
    return { error: `Row ${rowIndex}: Invalid amount format "${amountStr}"` }
  }
  
  const amount = parseFloat(cleanAmountStr)
  if (isNaN(amount) || !isFinite(amount)) {
    return { error: `Row ${rowIndex}: Invalid amount "${amountStr}"` }
  }

  // Just keep the date as-is from Excel
  const formattedDate = date.trim()

  // Basic validation - just check it's not empty
  if (!formattedDate) {
    return { error: `Row ${rowIndex}: Missing date` }
  }

  return {
    expense: {
      property,
      date: formattedDate,
      description,
      vendor,
      amount,
    },
  }
}

const parseExcelFile = async (
  file: File
): Promise<{ expenses?: ExcelExpense[]; error?: string }> => {
  // Early validation - file size check
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  if (file.size > MAX_FILE_SIZE) {
    return Promise.resolve({ 
      error: 'File is too large. Please upload a file smaller than 10MB.' 
    })
  }

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]!]

        if (!worksheet) {
          resolve({ error: 'Unable to read Excel file' })
          return
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        if (jsonData.length < 2) {
          resolve({
            error: 'Excel file needs at least 2 rows (headers + data)',
          })
          return
        }

        // Early validation - row count check
        if (jsonData.length > 1002) { // 1000 data rows + 2 for headers + buffer
          resolve({
            error: 'File has too many rows. Please limit to 1000 expense rows.',
          })
          return
        }

        // Validate headers
        const headers = (jsonData[0] as unknown[]).map((h) => parseExcelCell(h))
        const missingColumns = validateHeaders(headers)

        if (missingColumns.length > 0) {
          resolve({ error: `Missing columns: ${missingColumns.join(', ')}` })
          return
        }

        // Find column indices
        const normalizedHeaders = headers.map((h) => h.toLowerCase().trim())
        const columnIndices = {
          property: normalizedHeaders.findIndex((h) => h.includes('property')),
          date: normalizedHeaders.findIndex((h) => h.includes('date')),
          description: normalizedHeaders.findIndex((h) =>
            h.includes('description')
          ),
          vendor: normalizedHeaders.findIndex((h) => h.includes('vendor')),
          amount: normalizedHeaders.findIndex((h) => h.includes('amount')),
        }

        // Parse rows
        const expenses: ExcelExpense[] = []
        const errors: string[] = []

        for (let i = 1; i < jsonData.length; i++) {
          const result = parseExpenseRow(
            jsonData[i] as unknown[],
            columnIndices,
            i + 1
          )

          if (result.expense) {
            expenses.push(result.expense)
          } else if (result.error) {
            errors.push(result.error)
          }
        }

        if (errors.length > 0) {
          resolve({
            error: `Found ${errors.length} errors:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...and more' : ''}`,
          })
          return
        }

        if (expenses.length === 0) {
          resolve({ error: 'No valid expenses found' })
          return
        }

        resolve({ expenses })
      } catch (err) {
        resolve({ error: `Failed to parse Excel file ${err instanceof Error ? err.message : 'Unknown error'}` })
      }
    }

    reader.onerror = () => resolve({ error: 'Failed to read file' })
    reader.readAsArrayBuffer(file)
  })
}

export default function VendorExcelImporter({
  currentStatementId,
  onSuccess,
}: VendorExcelImporterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [expenses, setExpenses] = useState<ExcelExpense[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('upload')
  const [previewData, setPreviewData] = useState<VendorImportPreviewResponse | null>(null)
  const [processingMessage, setProcessingMessage] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get current statement for available properties
  const { data: currentStatement } = api.ownerStatement.getOne.useQuery(
    { id: currentStatementId },
    { enabled: !!currentStatementId }
  )

  const { data: monthStatements } = api.ownerStatement.getMany.useQuery(
    {
      month: currentStatement?.statementMonth
        ? new Date(currentStatement.statementMonth).toISOString().slice(0, 7)
        : undefined,
    },
    { enabled: !!currentStatement?.statementMonth }
  )

  const availableProperties =
    monthStatements?.map((s) => s.property?.name).filter(Boolean) ?? []

  const importMutation = api.ownerStatement.importVendorExpensesFromExcel.useMutation()

  const handleClose = () => {
    setIsOpen(false)
    setFile(null)
    setExpenses([])
    setError(null)
    setCurrentStep('upload')
    setPreviewData(null)
    setProcessingMessage('')
  }

  const handleFileChange = async (newFile: File | null) => {
    if (!newFile) return

    if (!newFile.name.endsWith('.xlsx') && !newFile.name.endsWith('.xls')) {
      setError('Please select an Excel file (.xlsx or .xls)')
      return
    }

    setFile(newFile)
    setCurrentStep('processing')
    setProcessingMessage('Parsing Excel file...')
    setError(null)

    const result = await parseExcelFile(newFile)

    if (result.error) {
      setError(result.error)
      setCurrentStep('upload')
      return
    }

    if (result.expenses) {
      setExpenses(result.expenses)
      // Automatically get preview after parsing
      await getPreview(result.expenses)
    }
  }

     const getPreview = async (expenseData: ExcelExpense[]) => {
     setCurrentStep('processing')
     setProcessingMessage('Matching properties with AI...')

     try {
       const previewResult = await importMutation.mutateAsync({
         currentStatementId,
         expenses: expenseData,
       })

       if (previewResult.success) {
         setPreviewData(previewResult)
         setCurrentStep('preview')
       } else {
         setError('Failed to process expenses')
         setCurrentStep('upload')
       }
     } catch (err) {
       setError(err instanceof Error ? err.message : 'Failed to process expenses')
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

    try {
      const response = await fetch('/api/vendor-import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatementId,
          approvedMatches: previewData.preview.matched,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText)
      }

      const confirmData = await response.json() as VendorImportConfirmResponse

      if (confirmData.success) {
        SuccessToast(`Successfully created ${confirmData.createdCount} expenses`)
        handleClose()
        onSuccess?.()
      } else {
        ErrorToast('Failed to create expenses')
        setCurrentStep('preview')
      }
    } catch (err) {
      ErrorToast(err instanceof Error ? err.message : 'Failed to create expenses')
      setCurrentStep('preview')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileChange(e.target.files?.[0] ?? null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    void handleFileChange(e.dataTransfer.files[0] ?? null)
  }

  const isProcessing = ['processing', 'confirming'].includes(currentStep)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="text-xs py-1 h-7"
      >
        <FileSpreadsheet className="w-3 h-3 mr-1" />
        Import Vendor Excel
      </Button>

      <Dialog open={isOpen} onClose={handleClose} size="lg">
        <DialogTitle>Import Vendor Expenses from Excel</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className={currentStep === 'upload' ? 'text-primary font-medium' : ''}>
                1. Upload
              </span>
              <span className={currentStep === 'processing' ? 'text-primary font-medium' : ''}>
                2. Processing
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
                  Upload an Excel file with columns:{' '}
                  <strong>property, date, description, vendor, amount</strong>
                </p>

                {/* Available Properties */}
                {availableProperties.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2">
                      Available Properties:
                    </h4>
                    <div className="text-xs max-h-20 overflow-y-auto">
                      {availableProperties.map((property, index) => (
                        <div key={index}>• {property}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div>
                  <Label>Excel File</Label>
                  <div
                    className="mt-1 border-2 border-dashed border-zinc-300 rounded-lg p-4 text-center cursor-pointer hover:bg-zinc-50"
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    {file ? (
                      <div className="text-sm">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Drag and drop or click to select Excel file
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="text-sm text-red-800 dark:text-red-200 whitespace-pre-line">
                      {error}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Processing Step */}
            {currentStep === 'processing' && (
              <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-blue-800">
                    {processingMessage}
                  </span>
                </div>
                <p className="text-xs text-blue-600">
                  {expenses.length > 0 ? 
                    `Found ${expenses.length} expenses. Now matching properties...` :
                    'Reading Excel file and validating data...'
                  }
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
            disabled={isProcessing}
          >
            {currentStep === 'preview' ? 'Cancel' : 'Close'}
          </Button>

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
