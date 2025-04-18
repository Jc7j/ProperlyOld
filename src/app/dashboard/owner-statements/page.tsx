'use client'

import { Link } from 'lucide-react'
import { useState } from 'react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import * as XLSX from 'xlsx'
import {
  Button,
  Card,
  Heading,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

import ImportModal from './ImportModal'
import OwnerStatementReviewStepper from './OwnerStatementReviewStepper'

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

  // Fetch properties for filter dropdown
  const { data: properties, isLoading: loadingProperties } =
    api.property.getMany.useQuery()

  // Fetch owner statements with filters
  const { data: ownerStatements, isLoading } =
    api.ownerStatement.getMany.useQuery({
      propertyId: propertyId || undefined,
      month: month ? dayjs(month).format('YYYY-MM') : undefined,
    })

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Heading level={1}>Owner Statements</Heading>
        <Button color="primary-solid" onClick={() => setIsModalOpen(true)}>
          Import Owner Statements (Excel)
        </Button>
      </div>
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Property</label>
            <Select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="min-w-[180px]"
              disabled={loadingProperties}
            >
              <option value="">All</option>
              {properties?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Month</label>
            <ReactDatePicker
              selected={month}
              onChange={setMonth}
              dateFormat="MMMM yyyy"
              showMonthYearPicker
              placeholderText="Select a month"
              className="min-w-[140px] rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              wrapperClassName="min-w-[140px]"
            />
          </div>
        </div>
      </Card>
      <Card>
        <Table striped>
          <TableHead className="z-0">
            <TableRow>
              <TableHeader>Property</TableHeader>
              <TableHeader>Month</TableHeader>
              <TableHeader align="right">Total Income</TableHeader>
              <TableHeader align="right">Total Expenses</TableHeader>
              <TableHeader align="right">Total Adjustments</TableHeader>
              <TableHeader align="right">Grand Total</TableHeader>
              <TableHeader>Notes</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : ownerStatements?.length ? (
              ownerStatements.map((os: any) => (
                <TableRow key={os.id}>
                  <TableCell>{os.property?.name || '-'}</TableCell>
                  <TableCell>
                    {dayjs(os.statementMonth).format('MMMM YYYY')}
                  </TableCell>
                  <TableCell align="right">
                    {os.totalIncome?.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }) || '-'}
                  </TableCell>
                  <TableCell align="right">
                    {os.totalExpenses?.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }) || '-'}
                  </TableCell>
                  <TableCell align="right">
                    {os.totalAdjustments?.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }) || '-'}
                  </TableCell>
                  <TableCell align="right">
                    {os.grandTotal?.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }) || '-'}
                  </TableCell>
                  <TableCell>{os.notes || ''}</TableCell>
                  <TableCell>
                    <Link
                      color="primary-solid"
                      href={`/dashboard/owner-statements/${os.id}`}
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No owner statements found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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
        setParsedData={setParsedData}
        setError={setError}
        setLoading={setIsParsing}
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
