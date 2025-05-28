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
import { SuccessToast } from '~/components/ui/sonner'
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

interface ImportState {
  isOpen: boolean
  file: File | null
  expenses: ExcelExpense[]
  error: string | null
  isLoading: boolean
}

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

  // Parse amount
  const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''))
  if (isNaN(amount)) {
    return { error: `Row ${rowIndex}: Invalid amount "${amountStr}"` }
  }

  // Format date
  let formattedDate = date
  if (date.includes('/')) {
    const parts = date.split('/')
    if (parts.length === 3) {
      const [month, day, year] = parts
      if (month && day && year) {
        formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
    }
  }

  // Validate date
  if (isNaN(new Date(formattedDate).getTime())) {
    return { error: `Row ${rowIndex}: Invalid date "${date}"` }
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
        resolve({ error: 'Failed to parse Excel file' })
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
  const [state, setState] = useState<ImportState>({
    isOpen: false,
    file: null,
    expenses: [],
    error: null,
    isLoading: false,
  })

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

  const importMutation =
    api.ownerStatement.importVendorExpensesFromExcel.useMutation({
      onSuccess: (data) => {
        SuccessToast(`Successfully imported ${data.createdCount} expenses`)
        handleClose()
        onSuccess?.()
      },
      onError: (error) => {
        setState((prev) => ({
          ...prev,
          error: error.message || 'Import failed',
        }))
      },
    })

  const handleClose = () => {
    setState({
      isOpen: false,
      file: null,
      expenses: [],
      error: null,
      isLoading: false,
    })
  }

  const handleFileChange = async (file: File | null) => {
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setState((prev) => ({
        ...prev,
        error: 'Please select an Excel file (.xlsx or .xls)',
      }))
      return
    }

    setState((prev) => ({ ...prev, file, isLoading: true, error: null }))

    const result = await parseExcelFile(file)

    setState((prev) => ({
      ...prev,
      isLoading: false,
      expenses: result.expenses ?? [],
      error: result.error ?? null,
    }))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileChange(e.target.files?.[0] ?? null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    void handleFileChange(e.dataTransfer.files[0] ?? null)
  }

  const handleSubmit = () => {
    if (state.expenses.length === 0) return

    importMutation.mutate({
      currentStatementId,
      expenses: state.expenses,
    })
  }

  const previewExpenses = state.expenses.slice(0, 5)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setState((prev) => ({ ...prev, isOpen: true }))}
        className="text-xs py-1 h-7"
      >
        <FileSpreadsheet className="w-3 h-3 mr-1" />
        Import Vendor Excel
      </Button>

      <Dialog open={state.isOpen} onClose={handleClose} size="lg">
        <DialogTitle>Import Vendor Expenses from Excel</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
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
                {state.file ? (
                  <div className="text-sm">
                    <p className="font-medium">{state.file.name}</p>
                    <p className="text-muted-foreground">
                      {(state.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {state.isLoading
                      ? 'Processing...'
                      : 'Drag and drop or click to select Excel file'}
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {previewExpenses.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2">
                  Preview ({state.expenses.length} expenses found):
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-1">Property</th>
                        <th className="text-left p-1">Date</th>
                        <th className="text-left p-1">Description</th>
                        <th className="text-left p-1">Vendor</th>
                        <th className="text-right p-1">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewExpenses.map((expense, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-1 truncate max-w-20">
                            {expense.property}
                          </td>
                          <td className="p-1">{expense.date}</td>
                          <td className="p-1 truncate max-w-24">
                            {expense.description}
                          </td>
                          <td className="p-1 truncate max-w-20">
                            {expense.vendor}
                          </td>
                          <td className="p-1 text-right">
                            ${expense.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {state.expenses.length > 5 && (
                    <p className="text-xs mt-2">
                      ... and {state.expenses.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {state.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="text-sm text-red-800 dark:text-red-200 whitespace-pre-line">
                  {state.error}
                </div>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={
              importMutation.isPending ||
              state.expenses.length === 0 ||
              state.isLoading
            }
          >
            {importMutation.isPending
              ? 'Importing...'
              : `Import ${state.expenses.length} Expenses`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
