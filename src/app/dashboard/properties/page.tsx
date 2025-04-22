'use client'

import {
  type Column,
  type ColumnDef,
  type PaginationState,
  type Row,
  type SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'
import { DataTable } from '~/components/table/data-table'
import { DataTableColumnHeader } from '~/components/table/data-table-column-header'
import { DataTablePagination } from '~/components/table/data-table-pagination'
import { Button, ErrorToast, Heading } from '~/components/ui'
import { ROUTES } from '~/lib/constants/routes'
import { cn } from '~/lib/utils/cn'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

type PropertyData = {
  id: string
  managementGroupId: string
  name: string
  locationInfo: {
    address?: string | null
    city?: string | null
    state?: string | null
    postalCode?: string | null
    country?: string | null
    timezone?: string | null
  } | null
  owner: {
    name?: string | null
    email?: string | null
    phone?: string | null
  } | null
  createdAt: Date | null
  updatedAt: Date | null
  createdBy: string
  updatedBy: string
  deletedAt: Date | null
  totalInvoices: number
  latestInvoiceDate: Date | null
}

export const propertyColumns = (): ColumnDef<PropertyData>[] => [
  {
    accessorKey: 'name',
    header: ({ column }: { column: Column<PropertyData, unknown> }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }: { row: Row<PropertyData> }) => (
      <div>{row.getValue('name')}</div>
    ),
  },
  {
    id: 'address',
    accessorFn: (row) => row.locationInfo?.address,
    header: ({ column }: { column: Column<PropertyData, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title="Address"
        className="justify-end text-right"
      />
    ),
    cell: ({ row }: { row: Row<PropertyData> }) => {
      const addressValue = row.getValue('address')
      const address =
        typeof addressValue === 'string' && addressValue ? addressValue : null
      return (
        <div className="text-right text-zinc-600 dark:text-zinc-400">
          {address ?? '-'}
        </div>
      )
    },
    enableSorting: false,
  },
  {
    id: 'ownerName',
    accessorFn: (row) => row.owner?.name,
    header: ({ column }: { column: Column<PropertyData, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title="Owner"
        className="justify-end text-right"
      />
    ),
    cell: ({ row }: { row: Row<PropertyData> }) => (
      <div className="text-right text-zinc-600 dark:text-zinc-400">
        {row.getValue('ownerName') ?? 'N/A'}
      </div>
    ),
  },
  {
    accessorKey: 'totalInvoices',
    header: ({ column }: { column: Column<PropertyData, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title="# of Invoices"
        className="justify-end"
      />
    ),
    cell: ({ row }: { row: Row<PropertyData> }) => (
      <div className="flex flex-col items-end gap-1 text-right text-zinc-600 dark:text-zinc-400">
        <span>{row.getValue('totalInvoices')}</span>
        {row.original.latestInvoiceDate && (
          <span className="text-xs">
            Latest:{' '}
            {dayjs(row.original.latestInvoiceDate).format('MMM D, YYYY')}
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'updatedAt',
    header: ({ column }: { column: Column<PropertyData, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title="Last Updated"
        className="justify-end"
      />
    ),
    cell: ({ row }: { row: Row<PropertyData> }) => {
      const updatedAtValue = row.getValue('updatedAt')
      const updatedAt =
        typeof updatedAtValue === 'string' || updatedAtValue instanceof Date
          ? updatedAtValue
          : null

      return (
        <div
          className={cn(
            'text-right text-sm',
            updatedAt
              ? 'text-zinc-600 dark:text-zinc-400'
              : 'text-red-600 dark:text-red-400'
          )}
        >
          {updatedAt ? dayjs(updatedAt).fromNow() : 'N/A'}
        </div>
      )
    },
    sortingFn: 'datetime',
  },
]

function PropertiesTableSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="grid animate-pulse gap-4 p-4">
        <div className="h-8 w-48 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="space-y-3">
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function PropertiesContent() {
  const router = useRouter()
  const { data: properties, isPending } = api.property.getMany.useQuery()
  const [searchQuery, setSearchQuery] = useState('')

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'name', desc: false },
  ])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const columns = useMemo(() => propertyColumns(), [])

  const filteredProperties = useMemo(() => {
    const currentProperties = properties as PropertyData[] | undefined
    if (!currentProperties) return []
    return currentProperties.filter(
      (property) =>
        property.name.toLowerCase().includes(searchQuery.toLowerCase()) ??
        property.locationInfo?.address
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ??
        property.owner?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [properties, searchQuery])

  const table = useReactTable({
    data: filteredProperties,
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
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (isPending) {
    return <PropertiesTableSkeleton />
  }

  if (!properties?.length) {
    return (
      <div className="text-center">
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="mx-auto size-12 text-muted-foreground"
        >
          <path
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h3 className="mt-2 text-sm font-semibold">No properties</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Get started by creating a new property.
        </p>
      </div>
    )
  }

  if (!isPending && !table.getRowModel().rows.length && searchQuery) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="size-4 text-zinc-400" />
          </div>
          <input
            type="text"
            placeholder="Search properties..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              table.setPageIndex(0)
            }}
            className={cn(
              'w-full rounded-lg border bg-white px-3 py-2 pl-10 text-sm outline-none transition-all',
              'border-zinc-200 placeholder:text-zinc-400',
              'dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600',
              'focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
              'dark:focus:border-primary/50 dark:focus:ring-primary/20'
            )}
          />
        </div>
        <div className="text-center py-10">
          <p className="text-muted-foreground">
            No properties found matching &quot;{searchQuery}&quot;.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="size-4 text-zinc-400" />
        </div>
        <input
          type="text"
          placeholder="Search properties..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            table.setPageIndex(0)
          }}
          className={cn(
            'w-full rounded-lg border bg-white px-3 py-2 pl-10 text-sm outline-none transition-all',
            'border-zinc-200 placeholder:text-zinc-400',
            'dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600',
            'focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
            'dark:focus:border-primary/50 dark:focus:ring-primary/20'
          )}
        />
      </div>

      <DataTable<PropertyData>
        table={table}
        onRowClick={(row: { original: PropertyData }) =>
          router.push(`/dashboard/properties/${row.original.id}`)
        }
      />

      <div className="mt-4">
        <DataTablePagination table={table} />
      </div>
    </div>
  )
}

export default function PropertiesPage() {
  const router = useRouter()
  const utils = api.useUtils()
  const { mutate: createProperty, isPending: isCreating } =
    api.property.create.useMutation({
      onSuccess: async (newProperty) => {
        await utils.property.getMany.invalidate()
        router.push(`${ROUTES.DASHBOARD.PROPERTIES}/${newProperty}`)
      },
      onError: (error) => {
        console.error(error)
        ErrorToast(
          'Failed to create property. Contact support if the problem persists.'
        )
      },
    })

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Heading level={1}>Properties</Heading>
        <Button onClick={() => createProperty()} disabled={isCreating}>
          <Plus className="size-4" />
          <span>{isCreating ? 'Creating...' : 'Add Property'}</span>
        </Button>
      </div>

      <Suspense fallback={<PropertiesTableSkeleton />}>
        <PropertiesContent />
      </Suspense>
    </div>
  )
}
