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
import { ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import CreateItemDialog from '~/components/supply/CreateItemDialog'
import EditItemDialog from '~/components/supply/EditItemDialog'
import { DataTable } from '~/components/table/data-table'
import { DataTableColumnHeader } from '~/components/table/data-table-column-header'
import { DataTablePagination } from '~/components/table/data-table-pagination'
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  Heading,
  Spinner,
} from '~/components/ui'
import { cn } from '~/lib/utils/cn'
import { formatCurrency } from '~/lib/utils/format'
import { type ManagementGroupItemWithUser } from '~/server/api/routers/managementGroupItems'
import { api } from '~/trpc/react'

const ITEMS_PER_PAGE = 15

export default function SuppliesPage() {
  const { data: items, isLoading } = api.managementGroupItems.getMany.useQuery()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingItem, setEditingItem] =
    useState<ManagementGroupItemWithUser | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Drawer state for item details
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedItem, setSelectedItem] =
    useState<ManagementGroupItemWithUser | null>(null)

  // Add delete mutation
  const utils = api.useUtils()
  const { mutate: deleteItem } = api.managementGroupItems.delete.useMutation({
    onSuccess: () => {
      void utils.managementGroupItems.getMany.invalidate()
    },
  })

  // Sorting and pagination state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'name', desc: false },
  ])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: ITEMS_PER_PAGE,
  })

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!items) return []

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [items, searchQuery])

  // Reset to first page when search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [searchQuery])

  // Function to view item details in drawer
  const viewItemDetails = (item: ManagementGroupItemWithUser) => {
    setSelectedItem(item)
    setDrawerOpen(true)
  }

  // Define columns
  const columns = useMemo<ColumnDef<ManagementGroupItemWithUser>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="max-w-md">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {item.name}
                  </span>
                  {item.description && (
                    <p className="line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {item.link && (
                  <Link
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'rounded-full p-2 transition-all duration-200',
                      'text-blue-500 hover:bg-zinc-100 hover:text-blue-600',
                      'dark:text-blue-400 dark:hover:bg-zinc-800 dark:hover:text-blue-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="size-4" />
                  </Link>
                )}
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingItem(item)
                  }}
                  className={cn(
                    'rounded-full p-2 transition-all duration-200',
                    'text-amber-500 hover:bg-zinc-100 hover:text-amber-600',
                    'dark:text-amber-400 dark:hover:bg-zinc-800 dark:hover:text-amber-400'
                  )}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Are you sure you want to delete this item?')) {
                      deleteItem({ id: item.id })
                    }
                  }}
                  className={cn(
                    'rounded-full p-2 transition-all duration-200',
                    'text-red-500 hover:bg-zinc-100 hover:text-red-600',
                    'dark:text-red-400 dark:hover:bg-zinc-800 dark:hover:text-red-400'
                  )}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          )
        },
        enableSorting: true,
      },
      {
        accessorKey: 'defaultPrice',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Price"
            className="text-right justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatCurrency(row.original.defaultPrice)}
          </div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'quantityOnHand',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="On Hand"
            className="text-right justify-end"
          />
        ),
        cell: ({ row }) => {
          const quantity = row.original.quantityOnHand
          return (
            <div
              className={cn(
                'text-right tabular-nums',
                quantity < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-900 dark:text-zinc-50'
              )}
            >
              {quantity}
            </div>
          )
        },
        enableSorting: true,
      },
      {
        accessorKey: 'quantityUsed',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Used"
            className="text-right justify-end"
          />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-zinc-900 dark:text-zinc-50">
            {row.original.quantityUsed}
          </div>
        ),
        enableSorting: true,
      },
    ],
    [deleteItem]
  )

  // Create table instance
  const table = useReactTable({
    data: filteredItems,
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
  })

  if (isLoading) return <Spinner size="lg" />

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Heading level={1}>Supplies</Heading>
          <Button
            variant="default"
            onClick={() => setIsCreateDialogOpen(true)}
            className="w-full sm:w-auto shrink-0"
          >
            <Plus className="size-4" />
            <span>Add Item</span>
          </Button>
        </div>

        {/* Search field */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="size-4 text-zinc-400" />
          </div>
          <input
            type="text"
            placeholder="Search supplies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-lg border bg-white px-3 py-2 pl-10 text-sm outline-none transition-all',
              'border-zinc-200 placeholder:text-zinc-400',
              'dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-600',
              'focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
              'dark:focus:border-primary/50 dark:focus:ring-primary/20'
            )}
          />
        </div>
      </div>

      {/* Show "No results" message when needed */}
      {filteredItems.length === 0 && !isLoading && (
        <div className="text-muted-foreground py-12 text-center">
          No items found matching your search.
        </div>
      )}

      <div className="space-y-4">
        <DataTable
          table={table}
          onRowClick={(row) => viewItemDetails(row.original)}
        />

        <DataTablePagination table={table} />
      </div>

      {/* Drawer for item details */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="right"
        showBackdrop={true}
      >
        {selectedItem && (
          <>
            <DrawerHeader
              title={
                <div className="flex items-center gap-2">
                  {selectedItem.name}
                  {selectedItem.link && (
                    <Link
                      href={selectedItem.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full p-1 text-blue-500 hover:bg-primary/10 hover:text-blue-600 focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="size-4" />
                    </Link>
                  )}
                </div>
              }
              description={selectedItem.description ?? undefined}
              onClose={() => setDrawerOpen(false)}
              action={
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDrawerOpen(false)
                    setEditingItem(selectedItem)
                  }}
                  className="text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-zinc-800"
                >
                  <Pencil className="size-4 mr-1" />
                  <span>Edit</span>
                </Button>
              }
            />
            <DrawerBody>
              <div className="space-y-6">
                {/* Key metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Price
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(selectedItem.defaultPrice)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      In Stock
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-2xl font-semibold tabular-nums',
                        selectedItem.quantityOnHand <= 0
                          ? 'text-red-600 dark:text-red-400'
                          : selectedItem.quantityOnHand < 5
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-green-600 dark:text-green-400'
                      )}
                    >
                      {selectedItem.quantityOnHand}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Used
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {selectedItem.quantityUsed}
                    </p>
                  </div>
                </div>

                {/* Detailed information */}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      Last Updated
                    </span>
                    <span className="text-sm text-zinc-900 dark:text-zinc-50">
                      {selectedItem.updatedAt
                        ? selectedItem.updatedAt.toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                Close
              </Button>
              <Button
                variant="destructiveOutline"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this item?')) {
                    deleteItem({ id: selectedItem.id })
                    setDrawerOpen(false)
                  }
                }}
              >
                <Trash2 className="size-4 mr-1" />
                Delete
              </Button>
              <Button
                onClick={() => {
                  setDrawerOpen(false)
                  setEditingItem(selectedItem)
                }}
              >
                <Pencil className="size-4 mr-1" />
                Edit
              </Button>
            </DrawerFooter>
          </>
        )}
      </Drawer>

      <CreateItemDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />

      {editingItem && (
        <EditItemDialog
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
        />
      )}
    </div>
  )
}
