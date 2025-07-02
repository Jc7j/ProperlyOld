import { useRouter } from 'next/navigation'
import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import DatePicker from '~/components/DatePicker'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '~/components/ui'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

interface ParsedHostawayData {
  propertyId: string
  propertyName: string
  incomes: Array<{
    checkIn: string
    checkOut: string
    days: number
    platform: string
    guest: string
    grossRevenue: number
    hostFee: number
    platformFee: number
    grossIncome: number
  }>
  expenses: Array<{
    date: string
    description: string
    vendor: string
    amount: number
  }>
  adjustments: Array<{
    checkIn?: string
    checkOut?: string
    description: string
    amount: number
  }>
  notes: string
}

// Consolidated state interface
interface ImportState {
  month: Date | null
  hostawayFile: File | null
  isParsing: boolean
  error: string | null
  userChoice: 'skip' | 'replace' | null
}

/**
 * Safely parse a number from Excel data, returning 0 for invalid values
 */
function safeParseNumber(value: any): number {
  if (value === null || value === undefined || value === "") {
    return 0
  }
  const parsed = Number(value)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Parse dates from Excel with multiple format support
 */
function parseExcelDate(dateValue: any): string {
  if (!dateValue) return ""
  
  if (dateValue instanceof Date) {
    return dayjs(dateValue).format('YYYY-MM-DD')
  }
  
  const dateStr = String(dateValue)
  if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(dateStr)) {
    return dayjs(dateStr, ['M/D/YY', 'MM/DD/YYYY', 'YYYY-MM-DD']).format('YYYY-MM-DD')
  }
  
  return dateStr
}

/**
 * Create property lookup map with name normalization
 */
function createPropertyMap(properties: any[]) {
  return new Map(
    properties.map((p: any) => [
      p.name?.replace(/\s+/g, '').toLowerCase() ?? '',
      p,
    ])
  )
}

/**
 * Normalize property name for matching
 */
function normalizePropertyName(name: string): string {
  return name.replace(/\s*\((OLD|NEW)\)\s*$/i, '').replace(/\s+/g, '').toLowerCase()
}

/**
 * Process a single income row from Excel
 */
function processIncomeRow(row: any): {
  checkIn: string
  checkOut: string
  days: number
  platform: string
  guest: string
  grossRevenue: number
  hostFee: number
  platformFee: number
  grossIncome: number
} {
  const rentalRevenue = safeParseNumber(row['Rental Revenue'])
  const airbnbTax = safeParseNumber(row['Airbnb Transient Occupancy Tax'])
  let grossRevenue = rentalRevenue
  if (airbnbTax > 0) {
    grossRevenue = rentalRevenue - airbnbTax
  }

  const hostFee = Math.round(grossRevenue * 0.15 * 100) / 100
  const channel = (row.Channel || '').toLowerCase()
  const platformFee =
    channel === 'vrbo'
      ? safeParseNumber(row['Payment Fees'])
      : safeParseNumber(row['Host Channel Fee'])

  return {
    guest: String(row.Guest ?? ''),
    checkIn: parseExcelDate(row['Check-in Date']),
    checkOut: parseExcelDate(row['Check-out Date']),
    days: safeParseNumber(row.Nights),
    platform: String(row.Channel ?? ''),
    grossRevenue,
    hostFee,
    platformFee,
    grossIncome: grossRevenue - hostFee - platformFee,
  }
}

/**
 * Validate parsed statement data
 */
function validateStatementData(statements: ParsedHostawayData[]): void {
  for (const statement of statements) {
    // Check incomes
    for (const income of statement.incomes) {
      if ([income.grossRevenue, income.hostFee, income.platformFee, income.grossIncome].some(isNaN)) {
        throw new Error(`Invalid numeric data found for property "${statement.propertyName}". Please check the Excel file.`)
      }
    }
    // Check expenses and adjustments
    for (const expense of statement.expenses) {
      if (isNaN(expense.amount)) {
        throw new Error(`Invalid expense amount for property "${statement.propertyName}".`)
      }
    }
    for (const adjustment of statement.adjustments) {
      if (isNaN(adjustment.amount)) {
        throw new Error(`Invalid adjustment amount for property "${statement.propertyName}".`)
      }
    }
  }
}

/**
 * Parse Excel file and return raw data
 */
async function parseExcelFile(file: File): Promise<any[]> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('No sheet found')
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) throw new Error('No worksheet found')
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' })
}

export default function MonthlyImportModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Consolidated state
  const [state, setState] = useState<ImportState>({
    month: null,
    hostawayFile: null,
    isParsing: false,
    error: null,
    userChoice: null,
  })

  const utils = api.useUtils()

  // Check for existing statements
  const { data: existingStatements, isLoading: isCheckingExisting } =
    api.ownerStatement.getMany.useQuery(
      { month: state.month ? dayjs(state.month).format('YYYY-MM') : undefined },
      { enabled: !!state.month }
    )

  // Derived state
  const hasExistingStatements = existingStatements && existingStatements.length > 0
  const needsUserChoice = hasExistingStatements && state.userChoice === null
  const canProceed = state.month && state.hostawayFile && !needsUserChoice

  // Create batch mutation
  const createBatchMutation = api.ownerStatement.createMonthlyBatch.useMutation({
    onSuccess: async (data) => {
      if (data.createdCount === 0) {
        ErrorToast('No new statements were created. All properties already have statements for this month.')
        return
      }

      let message = `Created ${data.createdCount} owner statement${data.createdCount !== 1 ? 's' : ''} successfully!`
      if (data.existingCount > 0) message += ` (Skipped ${data.existingCount} existing)`
      if (data.replacedCount > 0) message += ` (Replaced ${data.replacedCount} existing)`

      SuccessToast(message)

      if (data.firstStatementId) {
        router.push(`/dashboard/owner-statements?statement=${data.firstStatementId}`)
      }
      onClose()
    },
    onError: (error) => {
      ErrorToast(`Failed to create statements: ${error.message}`)
    },
  })

  // Event handlers
  const handleMonthChange = (newMonth: Date | null) => {
    setState(prev => ({ ...prev, month: newMonth, userChoice: null }))
  }

  const handleUserChoice = (choice: 'skip' | 'replace') => {
    if (choice === 'replace') {
      const confirmOverwrite = window.confirm(
        `This will REPLACE all existing statements for ${dayjs(state.month).format('MMMM YYYY')}. This action cannot be undone. Are you sure?`
      )
      if (!confirmOverwrite) return
    }
    setState(prev => ({ ...prev, userChoice: choice }))
  }

  const handleHostawayDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return

    if (
      file.type ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.name.endsWith('.xlsx')
    ) {
      setState(prev => ({ ...prev, hostawayFile: file, error: null }))
    } else {
      setState(prev => ({ ...prev, error: 'Please upload a valid .xlsx file.' }))
    }
  }



  // Main processing function - now much simpler
  async function handleProcessAndCreate() {
    if (!canProceed) return

    setState(prev => ({ ...prev, isParsing: true, error: null }))

    try {
      // Parse Excel file
      const rawData = await parseExcelFile(state.hostawayFile!)

      // Get properties
      const formattedMonth = dayjs(state.month).format('YYYY-MM')
      const properties = await utils.property.getMany.fetch({ month: formattedMonth })
      if (!properties || properties.length === 0) {
        throw new Error('No properties found for the selected month.')
      }

      // Process data
      const propertyMap = createPropertyMap(properties)
      const grouped: Record<string, ParsedHostawayData> = {}

      // Process each row
      for (const row of rawData) {
        const rawListingName = row.Listing || ''
        const normalizedName = normalizePropertyName(rawListingName)
        if (!normalizedName) continue

        const property = propertyMap.get(normalizedName)
        if (!property) continue

        if (!grouped[property.id]) {
          grouped[property.id] = {
            propertyId: property.id,
            propertyName: property.name,
            incomes: [],
            expenses: [],
            adjustments: [],
            notes: '',
          }
        }

        // Process income
        const income = processIncomeRow(row)
        grouped[property.id]?.incomes.push(income)

        // Process adjustments
        const resolutionSum = safeParseNumber(row['Airbnb Closed Resolutions Sum'])
        if (resolutionSum !== 0) {
          grouped[property.id]?.adjustments.push({
            description: 'Airbnb Resolution',
            amount: resolutionSum,
            checkIn: income.checkIn || undefined,
            checkOut: income.checkOut || undefined,
          })
        }
      }

      const parsedStatements = Object.values(grouped)
      validateStatementData(parsedStatements)

      // Create statements
      createBatchMutation.mutate({
        statementMonth: state.month!,
        hostawayData: parsedStatements,
        skipExisting: state.userChoice === 'skip',
      })
    } catch (err) {
      console.error('Error processing files:', err)
      setState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err.message : 'Failed to process files' 
      }))
    } finally {
      setState(prev => ({ ...prev, isParsing: false }))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>Import Monthly Owner Statements</DialogTitle>
      <DialogBody>
        <div className="space-y-6">
          {/* Month Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Statement Month
            </label>
            <DatePicker
              selected={state.month ?? undefined}
              onChange={handleMonthChange}
              showMonthYearPicker
              placeholderText="Select a month"
              className="w-full"
            />
            {isCheckingExisting && state.month && (
              <div className="text-xs text-blue-600 mt-1">
                Checking for existing statements...
              </div>
            )}
          </div>

          {/* Existing Statements Warning */}
          {hasExistingStatements && state.userChoice === null && (
            <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
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
                    Existing Statements Found
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Found {existingStatements.length} existing owner statement
                      {existingStatements.length !== 1 ? 's' : ''} for{' '}
                      {dayjs(state.month).format('MMMM YYYY')}:
                    </p>
                    <ul className="mt-1 list-disc list-inside">
                      {existingStatements.slice(0, 5).map((stmt) => (
                        <li key={stmt.id} className="text-xs">
                          {stmt.property?.name || 'Unknown Property'}
                        </li>
                      ))}
                      {existingStatements.length > 5 && (
                        <li className="text-xs">
                          ... and {existingStatements.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUserChoice('skip')}
                      className="text-xs"
                    >
                      Skip Existing Properties
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleUserChoice('replace')}
                      className="text-xs"
                    >
                      Replace All Statements
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setState(prev => ({ ...prev, month: null }))}
                      className="text-xs"
                    >
                      Choose Different Month
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Choice Confirmation */}
          {hasExistingStatements && state.userChoice && (
            <div className="border border-green-300 bg-green-50 rounded-lg p-3">
              <div className="text-sm text-green-800">
                ✓ You chose to{' '}
                <strong>
                  {state.userChoice === 'skip'
                    ? 'skip existing properties'
                    : 'replace all statements'}
                </strong>{' '}
                for {dayjs(state.month).format('MMMM YYYY')}.
                <button
                  onClick={() => setState(prev => ({ ...prev, userChoice: null }))}
                  className="ml-2 text-green-600 underline hover:no-underline"
                >
                  Change choice
                </button>
              </div>
            </div>
          )}

          {/* Hostaway File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Hostaway Data (.xlsx)
            </label>
            <div
              className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center cursor-pointer hover:bg-zinc-50"
              onDrop={handleHostawayDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setState(prev => ({ ...prev, hostawayFile: file, error: null }))
                  }
                }}
              />
              <div className="text-zinc-500 mb-2">
                Drag and drop your Hostaway Excel file here, or click to select
              </div>
              {state.hostawayFile && (
                <div className="text-zinc-700 font-medium">
                  {state.hostawayFile.name}
                </div>
              )}
            </div>
          </div>



          {/* Status Messages */}
          {state.isParsing && (
            <div className="text-blue-600 text-sm">Processing files...</div>
          )}
          {state.error && <div className="text-red-600 text-sm">{state.error}</div>}
        </div>
      </DialogBody>
      <DialogActions>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="default"
          disabled={
            !canProceed ||
            state.isParsing ||
            createBatchMutation.isPending ||
            isCheckingExisting
          }
          onClick={handleProcessAndCreate}
        >
          {createBatchMutation.isPending ? 'Creating...' : 'Create Statements'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
