'use client'

import {
  type Column,
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '~/components/table/data-table'
import { DataTableColumnHeader } from '~/components/table/data-table-column-header'
import { Button } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
import { api } from '~/trpc/react'

import { AddItemDialog } from './AddItemDialog'
import { EditItemDialog } from './EditItemDialog'

interface InvoiceDetailsProps {
  invoice: InvoiceWithUser
}

// Define invoice item type
type InvoiceItemData = {
  id: string
  customItemName: string | null
  managementGroupItem: {
    name: string
  } | null
  quantity: number
  price: number
  date: Date | null
  section: 'maintenance' | 'supply'
}

// Column definitions for invoice items
const invoiceItemColumns = (
  onEdit: (item: InvoiceItemData) => void,
  onDelete: (id: string) => void
): ColumnDef<InvoiceItemData>[] => [
  {
    accessorKey: 'description',
    header: ({ column }: { column: Column<InvoiceItemData, unknown> }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    accessorFn: (row) => row.customItemName ?? row.managementGroupItem?.name,
    size: 300,
    cell: ({ row }) => {
      const item = row.original
      return (
        <div>
          <div>{item.customItemName ?? item.managementGroupItem?.name}</div>
          {item.date && (
            <div className="text-sm text-zinc-500">
              {dayjs(item.date).format('MMM D, YYYY')}
            </div>
          )}
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'quantity',
    header: ({ column }: { column: Column<InvoiceItemData, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title="Quantity"
        className="justify-center text-center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.original.quantity}</div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'amount',
    header: ({ column }: { column: Column<InvoiceItemData, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title="Amount"
        className="justify-center text-center"
      />
    ),
    cell: ({ row }) => {
      const item = row.original
      return (
        <div className="text-center">
          {formatCurrency(item.price * item.quantity)}
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {item.quantity} ×{' '}
            {formatCurrency(item.price, 'USD', { hideZeroDecimals: true })}
          </div>
        </div>
      )
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.price * rowA.original.quantity
      const valueB = rowB.original.price * rowB.original.quantity
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0
    },
  },
  {
    id: 'actions',
    header: ({ column }: { column: Column<InvoiceItemData, unknown> }) => (
      <DataTableColumnHeader
        column={column}
        title="Actions"
        className="justify-center text-center"
      />
    ),
    cell: ({ row }) => (
      <div className="flex justify-center space-x-2">
        <Button variant="ghost" onClick={() => onEdit(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm('Are you sure you want to delete this item?')) {
              onDelete(row.original.id)
            }
          }}
        >
          <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
        </Button>
      </div>
    ),
    enableSorting: false,
  },
]

export function InvoiceDetails({ invoice }: InvoiceDetailsProps) {
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const utils = api.useUtils()

  // Add sorting state
  const [maintenanceSorting, setMaintenanceSorting] = useState<SortingState>([])
  const [supplySorting, setSupplySorting] = useState<SortingState>([])

  // Delete handler
  const { mutate: deleteItem } = api.invoiceItem.delete.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({
        propertyId: invoice.propertyId!,
        invoiceId: invoice.id,
      })
    },
  })

  // Prepare data for the tables
  const maintenanceItems = useMemo(() => {
    return (
      invoice.items
        ?.filter((item) => item.customItemName)
        .map((item) => ({
          ...item,
          section: 'maintenance' as const,
        })) ?? []
    )
  }, [invoice.items])

  const supplyItems = useMemo(() => {
    return (
      invoice.items
        ?.filter((item) => item.managementGroupItem !== null)
        .map((item) => ({
          ...item,
          section: 'supply' as const,
        })) ?? []
    )
  }, [invoice.items])

  // Column definitions
  const columns = useMemo(
    () =>
      invoiceItemColumns(
        (item) => setEditingItem(item),
        (id) => deleteItem({ id, invoiceId: invoice.id })
      ),
    [invoice.id, deleteItem]
  )

  // Create tables for each section with sorting enabled
  const maintenanceTable = useReactTable({
    data: maintenanceItems,
    columns,
    state: {
      sorting: maintenanceSorting,
    },
    onSortingChange: setMaintenanceSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const supplyTable = useReactTable({
    data: supplyItems,
    columns,
    state: {
      sorting: supplySorting,
    },
    onSortingChange: setSupplySorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Invoice Details
        </h2>
        <Button onClick={() => setIsAddingItem(true)}>
          <Plus className="size-4" />
          <span>Add Item</span>
        </Button>
      </div>

      {/* Maintenance Items Section */}
      {maintenanceItems.length > 0 && (
        <>
          <div className="bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              Maintenance Items
            </span>
          </div>
          <DataTable table={maintenanceTable} />
        </>
      )}

      {/* Supply Items Section */}
      {supplyItems.length > 0 && (
        <>
          <div className="bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
            <span className="font-medium text-blue-600 dark:text-blue-400">
              Supply Items (Taxed at 8.375%)
            </span>
          </div>
          <DataTable table={supplyTable} />
        </>
      )}

      <AddItemDialog
        isOpen={isAddingItem}
        onClose={() => setIsAddingItem(false)}
        propertyId={invoice.propertyId!}
        invoiceId={invoice.id}
      />

      {editingItem && (
        <EditItemDialog
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          propertyId={invoice.propertyId!}
          invoiceId={invoice.id}
        />
      )}
    </div>
  )
}
