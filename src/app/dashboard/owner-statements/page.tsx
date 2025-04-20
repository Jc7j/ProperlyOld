'use client'

import Link from 'next/link'
import { useState } from 'react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import * as XLSX from 'xlsx'
import {
  Button,
  Heading,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui'
import { cn } from '~/lib/utils/cn'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

import ImportModal from './ImportModal'
import OwnerStatementReviewStepper from './OwnerStatementReviewStepper'

// Define sort field and direction types
type SortField =
  | 'property'
  | 'month'
  | 'income'
  | 'expenses'
  | 'adjustments'
  | 'total'
  | 'notes'
type SortDirection = 'asc' | 'desc'

export default function OwnerStatementsPage() {
  const [propertyId, setPropertyId] = useState('')
  const [month, setMonth] = useState<Date | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parsedData, setParsedData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null)
  const [reviewDrafts, setReviewDrafts] = useState<any[] | null>(null)
  const [unmatchedListings, setUnmatchedListings] = useState<string[]>([])

  // Add sort state
  const [sortField, setSortField] = useState<SortField>('month')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Fetch properties for filter dropdown
  const { data: properties, isLoading: loadingProperties } =
    api.property.getMany.useQuery()

  // Fetch owner statements with filters
  const { data: ownerStatements, isLoading } =
    api.ownerStatement.getMany.useQuery({
      propertyId: propertyId || undefined,
      month: month ? dayjs(month).format('YYYY-MM') : undefined,
    })

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Sort button component
  const SortButton = ({
    field,
    children,
    align = 'left',
  }: {
    field: SortField
    children: React.ReactNode
    align?: 'left' | 'right' | 'center'
  }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className={cn(
        'flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white w-full text-xs font-medium text-gray-500 uppercase',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center'
      )}
    >
      {children}
      {sortField === field && (
        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
      )}
    </button>
  )

  // Parse file when selectedFile changes
  async function parseFile(file: File) {
    setIsParsing(true)
    setError(null)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error('No sheet found')
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) throw new Error('No worksheet found')
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
      setParsedData(json)
    } catch (err) {
      setError(
        `Failed to parse Excel file. Please check your file format. ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      )
      setParsedData(null)
    } finally {
      setIsParsing(false)
    }
  }

  // Watch for file selection
  if (selectedFile && !parsedData && !isParsing) {
    void parseFile(selectedFile)
  }

  // Map Excel data to OwnerStatement drafts
  const handleNextFromModal = () => {
    if (!parsedData || !selectedMonth || !properties) return
    // Map property name to propertyId (remove whitespace and lowercase)
    const propertyMap = new Map(
      properties.map((p: any) => [p.name.replace(/\s+/g, '').toLowerCase(), p])
    )
    const grouped: Record<string, any> = {}
    const unmatched: string[] = []
    for (const row of parsedData) {
      const listing = (row.Listing || '').replace(/\s+/g, '').toLowerCase()
      if (!listing) continue
      const property = propertyMap.get(listing)
      if (!property) {
        if (!unmatched.includes(row.Listing)) unmatched.push(row.Listing)
        continue
      }
      if (!grouped[property.id]) {
        grouped[property.id] = {
          propertyId: property.id,
          propertyName: property.name,
          statementMonth: selectedMonth,
          incomes: [],
          expenses: [],
          adjustments: [],
          notes: '',
        }
      }
      const rentalRevenue = Number(row['Rental Revenue']) ?? 0
      const airbnbTax = Number(row['Airbnb Transient Occupancy Tax']) ?? 0
      let grossRevenue = rentalRevenue
      if (airbnbTax > 0) {
        grossRevenue = rentalRevenue - airbnbTax
      }
      const hostFee = Math.round(grossRevenue * 0.15 * 100) / 100
      const totalPayout = Number(row['Total Payout']) ?? 0
      const channel = (row.Channel || '').toLowerCase()
      const platformFee =
        channel === 'vrbo'
          ? (Number(row['Payment Fees']) ?? 0)
          : (Number(row['Host Channel Fee']) ?? 0)

      grouped[property.id].incomes.push({
        guest: row.Guest,
        checkIn: row['Check-in Date'],
        checkOut: row['Check-out Date'],
        days: Number(row.Nights) ?? 0,
        platform: row.Channel,
        grossRevenue,
        hostFee,
        platformFee,
        grossIncome: Math.round((totalPayout - hostFee) * 100) / 100,
      })

      const resolutionSum = Number(row['Airbnb Closed Resolutions Sum']) ?? 0
      if (resolutionSum !== 0) {
        grouped[property.id].adjustments.push({
          description: 'Airbnb Resolution',
          amount: resolutionSum,
          checkIn: row['Check-in Date'] || null,
          checkOut: row['Check-out Date'] || null,
        })
      }
    }
    setReviewDrafts(Object.values(grouped))
    setUnmatchedListings(unmatched)
    setIsModalOpen(false)
  }

  // Sort the owner statements before rendering
  const sortedStatements = ownerStatements
    ? [...ownerStatements].sort((a, b) => {
        // Helper function for comparison with direction
        const compare = (aVal: any, bVal: any) => {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        // Helper for string comparison
        const compareStrings = (aStr: string, bStr: string) => {
          const result = aStr.localeCompare(bStr)
          return sortDirection === 'asc' ? result : -result
        }

        switch (sortField) {
          case 'property': {
            const aName = a.property?.name ?? ''
            const bName = b.property?.name ?? ''
            return compareStrings(aName, bName)
          }
          case 'month': {
            const aTime = new Date(a.statementMonth).getTime()
            const bTime = new Date(b.statementMonth).getTime()
            return compare(aTime, bTime)
          }
          case 'income': {
            const aIncome = a.totalIncome ?? 0
            const bIncome = b.totalIncome ?? 0
            return compare(aIncome, bIncome)
          }
          case 'expenses': {
            const aExpenses = a.totalExpenses ?? 0
            const bExpenses = b.totalExpenses ?? 0
            return compare(aExpenses, bExpenses)
          }
          case 'adjustments': {
            const aAdj = a.totalAdjustments ?? 0
            const bAdj = b.totalAdjustments ?? 0
            return compare(aAdj, bAdj)
          }
          case 'total': {
            const aTotal = a.grandTotal ?? 0
            const bTotal = b.grandTotal ?? 0
            return compare(aTotal, bTotal)
          }
          case 'notes': {
            const aNote = a.notes ?? ''
            const bNote = b.notes ?? ''
            return compareStrings(aNote, bNote)
          }
          default:
            return 0
        }
      })
    : []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <Heading level={1} className="text-2xl font-bold">
          Owner Statements
        </Heading>
        <div className="flex flex-col sm:flex-row gap-3 items-center mt-3 sm:mt-0">
          <div className="w-full sm:w-48 relative z-50">
            <ReactDatePicker
              selected={month}
              onChange={setMonth}
              dateFormat="MMM yyyy"
              showMonthYearPicker
              placeholderText="All Months"
              className="w-full border border-gray-300 p-2 rounded-md"
              wrapperClassName="w-full"
              popperClassName="z-[9999]"
              popperPlacement="bottom-end"
              isClearable
            />
          </div>
          <Button
            color="primary-solid"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-md w-full sm:w-auto"
          >
            Import
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <div className="text-sm font-medium mb-2">Property</div>
        <Select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-md"
          disabled={loadingProperties}
        >
          <option value="">All Properties</option>
          {properties?.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow className="border-b border-gray-200">
              <TableHeader className="py-3">
                <SortButton field="property">Property</SortButton>
              </TableHeader>
              <TableHeader className="py-3">
                <SortButton field="month">Month</SortButton>
              </TableHeader>
              <TableHeader className="py-3 text-right">
                <SortButton field="income" align="right">
                  Income
                </SortButton>
              </TableHeader>
              <TableHeader className="py-3 text-right">
                <SortButton field="expenses" align="right">
                  Expenses
                </SortButton>
              </TableHeader>
              <TableHeader className="py-3 text-right">
                <SortButton field="adjustments" align="right">
                  Adjustments
                </SortButton>
              </TableHeader>
              <TableHeader className="py-3 text-right">
                <SortButton field="total" align="right">
                  Total
                </SortButton>
              </TableHeader>
              <TableHeader className="py-3">
                <SortButton field="notes">Notes</SortButton>
              </TableHeader>
              <TableHeader className="py-3 text-right">Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4">
                  Loading statements...
                </TableCell>
              </TableRow>
            ) : !sortedStatements.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4">
                  No owner statements found.
                </TableCell>
              </TableRow>
            ) : (
              sortedStatements.map((os: any) => (
                <TableRow key={os.id} className="border-b border-gray-100">
                  <TableCell className="py-4">
                    {os.property?.name || '-'}
                  </TableCell>
                  <TableCell className="py-4">
                    {dayjs(os.statementMonth).format('MMM YYYY')}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    {typeof os.totalIncome === 'number'
                      ? os.totalIncome.toFixed(2)
                      : '-'}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    {typeof os.totalExpenses === 'number'
                      ? os.totalExpenses.toFixed(2)
                      : '-'}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    {typeof os.totalAdjustments === 'number'
                      ? os.totalAdjustments.toFixed(2)
                      : '-'}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    {typeof os.grandTotal === 'number'
                      ? os.grandTotal.toFixed(2)
                      : '-'}
                  </TableCell>
                  <TableCell className="py-4">{os.notes || ''}</TableCell>
                  <TableCell className="py-4 text-right">
                    <Link
                      href={`/dashboard/owner-statements/${os.id}`}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Import Modal */}
      <ImportModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onNext={handleNextFromModal}
        loading={isParsing}
        error={error}
        parsedData={parsedData}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        setError={setError}
        month={selectedMonth}
        setMonth={setSelectedMonth}
      />

      {/* Review Stepper */}
      {reviewDrafts && (
        <OwnerStatementReviewStepper
          drafts={reviewDrafts}
          unmatchedListings={unmatchedListings}
          onDone={() => {
            setReviewDrafts(null)
            setParsedData(null)
            setSelectedFile(null)
            setSelectedMonth(null)
          }}
        />
      )}
    </div>
  )
}
