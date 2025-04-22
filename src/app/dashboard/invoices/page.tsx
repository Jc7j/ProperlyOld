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
import ExportMonthlyInvoices from '~/components/home/ExportMonthlyInvoices'
import { DataTable } from '~/components/table/data-table'
import { DataTableColumnHeader } from '~/components/table/data-table-column-header'
import { DataTablePagination } from '~/components/table/data-table-pagination'
import { useDebouncedCallback } from '~/components/table/utils/useDebounceCallback'
import { Button, Heading, Input } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import type { InvoiceWithUser } from '~/server/api/routers/invoice'
import { api } from '~/trpc/react'

export default function InvoicesPage() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'invoiceDate', desc: true },
  ])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })
  const [propertyNameFilter, setPropertyNameFilter] = useState('')
  const [debouncedFilterForAPI, setDebouncedFilterForAPI] = useState('')

  const debouncedSetFilter = useDebouncedCallback((value: string) => {
    setDebouncedFilterForAPI(value)
    table.setPageIndex(0)
  }, 300)

  const { data: invoicesQueryResult, isLoading } = api.invoice.getMany.useQuery(
    {
      limit: pagination.pageSize,
      pageIndex: pagination.pageIndex,
      propertyName: debouncedFilterForAPI,
    },
    {}
  )

  const invoices = invoicesQueryResult?.invoices ?? []
  const totalCount = invoicesQueryResult?.totalCount ?? 0

  const columns = useMemo<ColumnDef<InvoiceWithUser>[]>(
    () => [
      {
        accessorKey: 'invoiceDate',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Month" />
        ),
        cell: ({ row }) => (
          <div>{dayjs(row.original.invoiceDate).format('MMM YYYY')}</div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'property.name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Property" />
        ),
        cell: ({ row }) => {
          const property = row.original.property
          const location = property?.locationInfo
          const addressString = location
            ? `${location.address}, ${location.city}, ${location.state} ${location.postalCode}`
            : null

          return (
            <div>
              <div>{property?.name ?? '-'}</div>
              {addressString && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {addressString}
                </div>
              )}
            </div>
          )
        },
        enableSorting: false, // Sorting by nested property name might require manual setup
      },
      {
        accessorKey: 'financialDetails.totalAmount',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Total Amount"
            className="justify-end text-right"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.financialDetails?.totalAmount, 'USD', {
              centsToDollars: true, // Assuming totalAmount is in cents based on owner statement example
            })}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <div>
            {row.original.createdAt
              ? dayjs(row.original.createdAt).format('MMM D, YYYY')
              : '-'}
          </div>
        ),
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.propertyId ? (
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={`/dashboard/properties/${row.original.propertyId}/invoice/${row.original.id}`}
                >
                  View
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled>
                View
              </Button>
            )}
          </div>
        ),
        enableSorting: false,
      },
    ],
    []
  )

  const table = useReactTable({
    data: invoices,
    columns,
    state: {
      sorting,
      pagination,
    },
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
  })

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Heading
          level={1}
          className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Invoices
        </Heading>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            placeholder="Search by Property..."
            value={propertyNameFilter}
            onChange={(e) => {
              const newValue = e.target.value
              setPropertyNameFilter(newValue)
              debouncedSetFilter(newValue)
            }}
            className="max-w-xs"
          />
          {/* TODO: Add filters here (e.g., month picker) */}
          <ExportMonthlyInvoices />
        </div>
      </div>

      {/* Data Table */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-10 text-zinc-500 dark:text-zinc-400">
            Loading invoices...
          </div>
        ) : !table.getRowModel().rows.length ? (
          <div className="text-center py-10 text-zinc-500 dark:text-zinc-400">
            {propertyNameFilter
              ? `No invoices found matching "${propertyNameFilter}".`
              : 'No invoices found.'}
            {/* TODO: Add a button to create the first invoice? */}
          </div>
        ) : (
          <DataTable table={table} />
        )}
        <DataTablePagination table={table} />
      </div>
    </main>
  )
}
