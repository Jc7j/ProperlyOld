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

export default function MonthlyImportModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const vendorFileInputRef = useRef<HTMLInputElement>(null)

  const [month, setMonth] = useState<Date | null>(null)
  const [hostawayFile, setHostawayFile] = useState<File | null>(null)
  const [vendorFiles, setVendorFiles] = useState<File[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userChoice, setUserChoice] = useState<'skip' | 'replace' | null>(null)

  const utils = api.useUtils()

  // Check for existing statements - this is our source of truth
  const { data: existingStatements, isLoading: isCheckingExisting } =
    api.ownerStatement.getMany.useQuery(
      { month: month ? dayjs(month).format('YYYY-MM') : undefined },
      { enabled: !!month }
    )

  // Derived state - no useState needed
  const hasExistingStatements =
    existingStatements && existingStatements.length > 0
  const needsUserChoice = hasExistingStatements && userChoice === null
  const canProceed = month && hostawayFile && !needsUserChoice

  // Create batch mutation
  const createBatchMutation = api.ownerStatement.createMonthlyBatch.useMutation(
    {
      onSuccess: async (data) => {
        if (data.createdCount === 0) {
          ErrorToast(
            'No new statements were created. All properties already have statements for this month.'
          )
          return
        }

        let message = `Created ${data.createdCount} owner statement${data.createdCount !== 1 ? 's' : ''} successfully!`

        if (data.existingCount > 0) {
          message += ` (Skipped ${data.existingCount} existing)`
        }

        if (data.replacedCount > 0) {
          message += ` (Replaced ${data.replacedCount} existing)`
        }

        SuccessToast(message)

        if (data.firstStatementId) {
          router.push(
            `/dashboard/owner-statements?statement=${data.firstStatementId}`
          )
        }
        onClose()
      },
      onError: (error) => {
        ErrorToast(`Failed to create statements: ${error.message}`)
      },
    }
  )

  // Reset user choice when month changes
  const handleMonthChange = (newMonth: Date | null) => {
    setMonth(newMonth)
    setUserChoice(null)
  }

  const handleUserChoice = (choice: 'skip' | 'replace') => {
    if (choice === 'replace') {
      const confirmOverwrite = window.confirm(
        `This will REPLACE all existing statements for ${dayjs(month).format('MMMM YYYY')}. This action cannot be undone. Are you sure?`
      )
      if (!confirmOverwrite) return
    }
    setUserChoice(choice)
  }

  // Handle file operations
  const handleHostawayDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return

    if (
      file.type ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.name.endsWith('.xlsx')
    ) {
      setHostawayFile(file)
      setError(null)
    } else {
      setError('Please upload a valid .xlsx file.')
    }
  }

  const handleVendorFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const pdfFiles = files.filter((f) => f.type === 'application/pdf')
    if (pdfFiles.length !== files.length) {
      setError('Please only select PDF files for vendor invoices.')
    } else {
      setVendorFiles((prev) => [...prev, ...pdfFiles])
      setError(null)
    }
  }

  const removeVendorFile = (index: number) => {
    setVendorFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // Parse Hostaway Excel file
  async function parseHostawayFile(file: File): Promise<any[]> {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('No sheet found')
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) throw new Error('No worksheet found')
    return XLSX.utils.sheet_to_json(worksheet, { defval: '' })
  }

  // Main processing function
  async function handleProcessAndCreate() {
    if (!canProceed) return

    setIsParsing(true)
    setError(null)

    try {
      const rawData = await parseHostawayFile(hostawayFile)
      const formattedMonth = dayjs(month).format('YYYY-MM')
      const properties = await utils.property.getMany.fetch({
        month: formattedMonth,
      })

      if (!properties || properties.length === 0) {
        throw new Error('No properties found for the selected month.')
      }

      // Create property map for matching
      const propertyMap = new Map(
        properties.map((p: any) => [
          p.name?.replace(/\s+/g, '').toLowerCase() ?? '',
          p,
        ])
      )

      // Group data by property
      const grouped: Record<string, ParsedHostawayData> = {}
      const unmatched: string[] = []

      for (const row of rawData) {
        const rawListingName = row.Listing || ''
        const normalizedListingName = rawListingName.replace(
          /\s*\((OLD|NEW)\)\s*$/i,
          ''
        )
        const listing = normalizedListingName.replace(/\s+/g, '').toLowerCase()

        if (!listing) continue

        const property = propertyMap.get(listing)
        if (!property) {
          if (!unmatched.includes(rawListingName))
            unmatched.push(rawListingName)
          continue
        }

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

        // Process income data
        const rentalRevenue = Number(row['Rental Revenue']) ?? 0
        const airbnbTax = Number(row['Airbnb Transient Occupancy Tax']) ?? 0
        let grossRevenue = rentalRevenue
        if (airbnbTax > 0) {
          grossRevenue = rentalRevenue - airbnbTax
        }

        const hostFee = Math.round(grossRevenue * 0.15 * 100) / 100
        const channel = (row.Channel || '').toLowerCase()
        const platformFee =
          channel === 'vrbo'
            ? (Number(row['Payment Fees']) ?? 0)
            : (Number(row['Host Channel Fee']) ?? 0)

        // Parse dates
        let checkInDateStr =
          row['Check-in Date'] instanceof Date
            ? dayjs(row['Check-in Date']).format('YYYY-MM-DD')
            : String(row['Check-in Date'] ?? '')

        if (
          typeof row['Check-in Date'] === 'string' &&
          /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(row['Check-in Date'])
        ) {
          checkInDateStr = dayjs(row['Check-in Date'], [
            'M/D/YY',
            'MM/DD/YYYY',
            'YYYY-MM-DD',
          ]).format('YYYY-MM-DD')
        }

        let checkOutDateStr =
          row['Check-out Date'] instanceof Date
            ? dayjs(row['Check-out Date']).format('YYYY-MM-DD')
            : String(row['Check-out Date'] ?? '')

        if (
          typeof row['Check-out Date'] === 'string' &&
          /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(row['Check-out Date'])
        ) {
          checkOutDateStr = dayjs(row['Check-out Date'], [
            'M/D/YY',
            'MM/DD/YYYY',
            'YYYY-MM-DD',
          ]).format('YYYY-MM-DD')
        }

        grouped[property.id]?.incomes.push({
          guest: String(row.Guest ?? ''),
          checkIn: checkInDateStr,
          checkOut: checkOutDateStr,
          days: Number(row.Nights) ?? 0,
          platform: String(row.Channel ?? ''),
          grossRevenue: grossRevenue,
          hostFee: hostFee,
          platformFee: platformFee,
          grossIncome: grossRevenue - hostFee - platformFee,
        })

        // Process adjustments
        const resolutionSum = Number(row['Airbnb Closed Resolutions Sum']) ?? 0
        if (resolutionSum !== 0) {
          grouped[property.id]?.adjustments.push({
            description: 'Airbnb Resolution',
            amount: resolutionSum,
            checkIn: checkInDateStr || undefined,
            checkOut: checkOutDateStr || undefined,
          })
        }
      }

      // Add monthly invoice totals as expenses
      const expenseDate = dayjs(month).endOf('month').format('YYYY-MM-DD')
      properties.forEach((prop: any) => {
        const propInvoiceTotal = prop.monthlyInvoiceTotal ?? 0
        if (propInvoiceTotal > 0) {
          if (grouped[prop.id]) {
            grouped[prop.id]?.expenses.push({
              date: expenseDate,
              description: 'Supplies',
              vendor: 'Avava',
              amount: propInvoiceTotal,
            })
          } else {
            grouped[prop.id] = {
              propertyId: prop.id,
              propertyName: prop.name ?? `Property ${prop.id}`,
              incomes: [],
              expenses: [
                {
                  date: expenseDate,
                  description: 'Supplies',
                  vendor: 'Avava',
                  amount: propInvoiceTotal,
                },
              ],
              adjustments: [],
              notes: 'Auto-generated for monthly invoice total.',
            }
          }
        }
      })

      const parsedStatements = Object.values(grouped)

      // Create all statements
      createBatchMutation.mutate({
        statementMonth: month,
        hostawayData: parsedStatements,
        skipExisting: userChoice === 'skip',
      })
    } catch (err) {
      console.error('Error processing files:', err)
      setError(err instanceof Error ? err.message : 'Failed to process files')
    } finally {
      setIsParsing(false)
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
              selected={month ?? undefined}
              onChange={handleMonthChange}
              showMonthYearPicker
              placeholderText="Select a month"
              className="w-full"
            />
            {isCheckingExisting && month && (
              <div className="text-xs text-blue-600 mt-1">
                Checking for existing statements...
              </div>
            )}
          </div>

          {/* Existing Statements Warning */}
          {hasExistingStatements && userChoice === null && (
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
                      {dayjs(month).format('MMMM YYYY')}:
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
                      onClick={() => setMonth(null)}
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
          {hasExistingStatements && userChoice && (
            <div className="border border-green-300 bg-green-50 rounded-lg p-3">
              <div className="text-sm text-green-800">
                ✓ You chose to{' '}
                <strong>
                  {userChoice === 'skip'
                    ? 'skip existing properties'
                    : 'replace all statements'}
                </strong>{' '}
                for {dayjs(month).format('MMMM YYYY')}.
                <button
                  onClick={() => setUserChoice(null)}
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
                    setHostawayFile(file)
                    setError(null)
                  }
                }}
              />
              <div className="text-zinc-500 mb-2">
                Drag and drop your Hostaway Excel file here, or click to select
              </div>
              {hostawayFile && (
                <div className="text-zinc-700 font-medium">
                  {hostawayFile.name}
                </div>
              )}
            </div>
          </div>

          {/* Vendor PDFs */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Vendor Invoices (PDFs) - Optional
            </label>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => vendorFileInputRef.current?.click()}
                className="w-full"
              >
                Add Vendor PDFs
              </Button>
              <input
                ref={vendorFileInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handleVendorFileSelect}
              />
              {vendorFiles.length > 0 && (
                <div className="space-y-1">
                  {vendorFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-zinc-50 rounded"
                    >
                      <span className="text-sm truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVendorFile(idx)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status Messages */}
          {isParsing && (
            <div className="text-blue-600 text-sm">Processing files...</div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
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
            isParsing ||
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
