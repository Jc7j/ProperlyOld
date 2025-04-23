'use client'

import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import * as XLSX from 'xlsx'
import ExportMonthlyStatements from '~/components/owner-statement/ExportMonthlyStatements'
import { DataTable } from '~/components/table/data-table'
import { DataTableColumnHeader } from '~/components/table/data-table-column-header'
import { DataTablePagination } from '~/components/table/data-table-pagination'
import { Button, Heading, Select } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

import ImportModal from './ImportModal'
import OwnerStatementReviewStepper from './OwnerStatementReviewStepper'

type OwnerStatementData = {
  id: string
  property: {
    name?: string | null
  } | null
  statementMonth: Date
  totalIncome: number | null
  totalExpenses: number | null
  totalAdjustments: number | null
  grandTotal: number | null
  notes: string | null
}

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

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'statementMonth', desc: true },
  ])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })

  const { data: properties, isLoading: loadingProperties } =
    api.property.getMany.useQuery()

  const { data: ownerStatements, isLoading } =
    api.ownerStatement.getMany.useQuery({
      propertyId: propertyId || undefined,
      month: month ? dayjs(month).format('YYYY-MM') : undefined,
    })

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

  // Define columns for the DataTable
  const columns = useMemo<ColumnDef<OwnerStatementData>[]>(
    () => [
      {
        accessorKey: 'property.name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Property" />
        ),
        cell: ({ row }) => <div>{row.original.property?.name ?? '-'}</div>,
        enableSorting: true,
      },
      {
        accessorKey: 'statementMonth',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Month"
            className="justify-end text-right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right">
            {dayjs(row.original.statementMonth).format('MMM YYYY')}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'totalIncome',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Income"
            className="justify-end text-right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.totalIncome, 'USD', {
              centsToDollars: false,
            })}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'totalExpenses',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Expenses"
            className="justify-end text-right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.totalExpenses, 'USD', {
              centsToDollars: false,
            })}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'totalAdjustments',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Adjustments"
            className="justify-end text-right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.totalAdjustments, 'USD', {
              centsToDollars: false,
            })}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'grandTotal',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Total"
            className="justify-end text-right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums font-medium">
            {formatCurrency(row.original.grandTotal, 'USD', {
              centsToDollars: false,
            })}
          </div>
        ),
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/owner-statements/${row.original.id}`}>
                View
              </Link>
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    []
  )

  // Create table instance
  const table = useReactTable({
    data: (ownerStatements as OwnerStatementData[]) ?? [], // Cast data and provide default
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false, // Client-side pagination
    manualSorting: false, // Client-side sorting
  })

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
          <ExportMonthlyStatements />
          <Button
            variant="default"
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

      {/* Replace Table with DataTable */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">
            Loading statements...
          </div>
        ) : !table.getRowModel().rows.length ? (
          <div className="text-center py-10 text-muted-foreground">
            No owner statements found matching your filters.
          </div>
        ) : (
          <DataTable table={table} />
        )}
        <DataTablePagination table={table} />
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
