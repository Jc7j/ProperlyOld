'use client'

import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import DatePicker from '~/components/DatePicker'
import ExportMonthlyIndividualStatements from '~/components/owner-statement/ExportMonthlyIndividualStatements'
import ExportMonthlyStatements from '~/components/owner-statement/ExportMonthlyStatements'
import { DataTable } from '~/components/table/data-table'
import { DataTableColumnHeader } from '~/components/table/data-table-column-header'
import { DataTableFacetedFilter } from '~/components/table/data-table-faceted-filter'
import { DataTablePagination } from '~/components/table/data-table-pagination'
import { DataTableToolbar } from '~/components/table/data-table-toolbar'
import { Button, Heading } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

import ImportModal from '../../../components/owner-statement/ImportModal'
import OwnerStatementReviewStepper from '../../../components/owner-statement/OwnerStatementReviewStepper'

// Define the expected shape of property data from the updated getMany query
type PropertyWithMonthlyTotal = {
  id: string
  name: string | null
  monthlyInvoiceTotal: number // Added this field
  // Add other fields from PropertyOverview if needed
}

type OwnerStatementData = {
  id: string
  property: {
    id: string
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
  const [date, setDate] = useState<Date | undefined>(undefined)
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
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // Use queryParams for the property query as well
  const queryParams = useMemo(() => {
    const params: { month?: string } = {}
    if (date) {
      params.month = dayjs(date).format('YYYY-MM')
    }
    return params
  }, [date])

  const { data: propertiesData } = api.property.getMany.useQuery(queryParams)
  // Cast the properties data to the expected type
  const properties = propertiesData as PropertyWithMonthlyTotal[] | undefined

  const {
    data: ownerStatements,
    isLoading,
    isError,
    error: queryError,
  } = api.ownerStatement.getMany.useQuery(queryParams)

  const propertyOptions = useMemo(() => {
    if (!properties) return []
    return properties
      .map((p: any) => ({
        label: p.name ?? 'Unnamed Property',
        value: p.name ?? 'Unnamed Property',
      }))
      .filter((option) => option.label !== 'Unnamed Property')
  }, [properties])

  const utils = api.useUtils() // Get tRPC utils

  useEffect(() => {
    if (selectedFile) {
      void parseFile(selectedFile)
    } else {
      setParsedData(null)
      setError(null)
    }
  }, [selectedFile])

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

  const handleNextFromModal = async () => {
    if (!parsedData || !selectedMonth) {
      setError('Missing parsed data or selected month.')
      return
    }

    setIsParsing(true)
    setError(null)

    let fetchedProperties: PropertyWithMonthlyTotal[] | undefined
    const formattedMonth = dayjs(selectedMonth).format('YYYY-MM')
    try {
      // Fetch properties specifically for the selected month
      fetchedProperties = await utils.property.getMany.fetch({
        month: formattedMonth,
      })

      if (!fetchedProperties) {
        throw new Error('Could not fetch property data for the selected month.')
      }
    } catch (err) {
      console.error('Error fetching properties for month:', err)
      setError(
        `Failed to fetch property data. ${err instanceof Error ? err.message : 'Unknown error'}`
      )
      setIsParsing(false)
      return
    }

    // NEW: Determine properties with existing statements for the selected month
    const propertiesWithExistingStatements = new Set<string>()
    if (ownerStatements && ownerStatements.length > 0) {
      ownerStatements.forEach((stmt) => {
        // Ensure property and property.id exist, and month matches
        if (
          stmt.property &&
          dayjs(stmt.statementMonth).format('YYYY-MM') === formattedMonth
        ) {
          propertiesWithExistingStatements.add(stmt.property.id)
        }
      })
    }

    const propertyMap = new Map(
      fetchedProperties.map((p: any) => [
        p.name?.replace(/\s+/g, '').toLowerCase() ?? '',
        p,
      ])
    )
    const grouped: Record<string, any> = {}
    const unmatched: string[] = []
    for (const row of parsedData) {
      const rawListingName = row.Listing || ''
      // Normalize the listing name by removing trailing (OLD) or (NEW), case-insensitive
      const normalizedListingName = rawListingName.replace(
        /\s*\((OLD|NEW)\)\s*$/i,
        ''
      )
      const listing = normalizedListingName.replace(/\s+/g, '').toLowerCase()
      if (!listing) continue
      const property = propertyMap.get(listing)
      if (!property) {
        if (!unmatched.includes(rawListingName)) unmatched.push(rawListingName) // Use original name for unmatched list
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
          hasExistingStatement: propertiesWithExistingStatements.has(
            property.id
          ),
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

      grouped[property.id].incomes.push({
        guest: String(row.Guest ?? ''),
        checkIn: checkInDateStr,
        checkOut: checkOutDateStr,
        days: Number(row.Nights) ?? 0,
        platform: String(row.Channel ?? ''),
        grossRevenue: grossRevenue,
        hostFee: hostFee,
        platformFee: platformFee,
        grossIncome: Math.round((totalPayout - hostFee) * 100) / 100,
      })

      const resolutionSum = Number(row['Airbnb Closed Resolutions Sum']) ?? 0
      if (resolutionSum !== 0) {
        grouped[property.id].adjustments.push({
          description: 'Airbnb Resolution',
          amount: resolutionSum,
          checkIn: checkInDateStr || null, // Use formatted date string
          checkOut: checkOutDateStr || null, // Use formatted date string
        })
      }
    }

    // Add monthly invoice totals as expenses using fetchedProperties
    if (fetchedProperties && selectedMonth) {
      const expenseDate = dayjs(selectedMonth)
        .endOf('month')
        .format('YYYY-MM-DD')

      fetchedProperties.forEach((prop) => {
        const propInvoiceTotal = prop.monthlyInvoiceTotal ?? 0

        if (propInvoiceTotal > 0) {
          const expenseItem = {
            date: expenseDate,
            description: 'Supplies',
            vendor: 'Avava',
            amount: propInvoiceTotal,
          }

          if (grouped[prop.id]) {
            // Add to existing draft
            if (!grouped[prop.id].expenses) {
              grouped[prop.id].expenses = []
            }
            grouped[prop.id].expenses.push(expenseItem)
          } else {
            // Create a new draft just for this invoice expense
            grouped[prop.id] = {
              propertyId: prop.id,
              propertyName: prop.name ?? `Property ${prop.id}`,
              statementMonth: selectedMonth,
              incomes: [],
              expenses: [expenseItem],
              adjustments: [],
              notes: 'Auto-generated for monthly invoice total.',
              hasExistingStatement: propertiesWithExistingStatements.has(
                prop.id
              ),
            }
          }
        }
      })
    }

    setReviewDrafts(Object.values(grouped))
    setUnmatchedListings(unmatched)
    setIsModalOpen(false)
    setIsParsing(false)
  }

  const handleOpenImportModal = () => {
    setSelectedMonth(date ?? null)
    setIsModalOpen(true)
  }

  const columns = useMemo<ColumnDef<OwnerStatementData>[]>(
    () => [
      {
        id: 'property.name',
        accessorKey: 'property.name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Property" />
        ),
        cell: ({ row }) => <div>{row.original.property?.name ?? '-'}</div>,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, id, value) => {
          const propertyName = row.original.property?.name
          return value.includes(propertyName)
        },
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
        enableColumnFilter: false,
      },
    ],
    []
  )

  const table = useReactTable({
    data: (ownerStatements as OwnerStatementData[]) ?? [],
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <Heading level={1} className="text-2xl font-bold">
          Owner Statements
        </Heading>
        <div className="flex flex-col sm:flex-row gap-3 items-center mt-3 sm:mt-0">
          <div className="w-full sm:w-48">
            <DatePicker
              selected={date}
              onChange={(selectedDate: Date | null) => {
                setDate(selectedDate ?? undefined)
              }}
              showMonthYearPicker
              placeholderText="All Months"
              isClearable
            />
          </div>
          <ExportMonthlyStatements />
          <ExportMonthlyIndividualStatements />
          <Button
            variant="default"
            onClick={handleOpenImportModal}
            className="px-4 py-2 rounded-md w-full sm:w-auto"
          >
            Import
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <DataTableToolbar table={table}>
          {table.getColumn('property.name') && (
            <DataTableFacetedFilter
              column={table.getColumn('property.name')}
              title="Property"
              options={propertyOptions}
            />
          )}
        </DataTableToolbar>

        {isError && (
          <div className="text-center py-10 text-red-600">
            Error loading statements: {queryError?.message ?? 'Unknown error'}
          </div>
        )}

        {isLoading && !isError && (
          <div className="text-center py-10 text-muted-foreground">
            Loading statements...
          </div>
        )}

        {!isLoading && !isError && !table.getRowModel().rows.length && (
          <div className="text-center py-10 text-muted-foreground">
            No owner statements found matching your filters.
          </div>
        )}

        {!isLoading && !isError && table.getRowModel().rows.length > 0 && (
          <DataTable table={table} />
        )}

        <DataTablePagination table={table} />
      </div>

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

      {reviewDrafts && (
        <OwnerStatementReviewStepper
          drafts={reviewDrafts}
          unmatchedListings={unmatchedListings}
          onDone={() => {
            if (selectedMonth) {
              setDate(selectedMonth)
            }
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
