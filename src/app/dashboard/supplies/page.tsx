'use client'

import {
  Boxes,
  ChevronRight,
  ChevronUp,
  DollarSign,
  ExternalLink,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { Fragment, useMemo, useState } from 'react'
import CreateItemDialog from '~/components/supply/CreateItemDialog'
import EditItemDialog from '~/components/supply/EditItemDialog'
import ExpandedInfo from '~/components/supply/ExpandedInfo'
import {
  Button,
  Heading,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui'
import { cn } from '~/lib/utils/cn'
import { formatCurrency } from '~/lib/utils/format'
import { type ManagementGroupItemWithUser } from '~/server/api/routers/managementGroupItems'
import { api } from '~/trpc/react'

type SortField = 'name' | 'defaultPrice' | 'quantityOnHand' | 'quantityUsed'
type SortDirection = 'asc' | 'desc'

export default function SuppliesPage() {
  const { data: items, isLoading } = api.managementGroupItems.getMany.useQuery()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingItem, setEditingItem] =
    useState<ManagementGroupItemWithUser | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Sort items
  const sortedItems = useMemo(() => {
    if (!items) return null

    return [...items].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }, [items, sortField, sortDirection])

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Add delete mutation
  const utils = api.useUtils()
  const { mutate: deleteItem } = api.managementGroupItems.delete.useMutation({
    onSuccess: () => {
      void utils.managementGroupItems.getMany.invalidate()
    },
  })

  if (isLoading) return <Spinner size="lg" />

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Heading level={1}>Supplies</Heading>
        <Button
          color="primary"
          onClick={() => setIsCreateDialogOpen(true)}
          className="w-full sm:w-auto shrink-0"
        >
          <Plus className="size-4" />
          <span>Add Item</span>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table striped>
          <TableHead>
            <TableRow>
              <TableHeader
                className="min-w-[300px] cursor-pointer select-none"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-zinc-400" />
                  Name
                  {sortField === 'name' && (
                    <ChevronUp
                      className={cn(
                        'size-4 transition-transform',
                        sortDirection === 'desc' && 'rotate-180'
                      )}
                    />
                  )}
                </div>
              </TableHeader>
              <TableHeader
                align="right"
                className="min-w-[100px] cursor-pointer select-none"
                onClick={() => handleSort('defaultPrice')}
              >
                <div className="flex items-center justify-end gap-2">
                  <DollarSign className="size-4 text-zinc-400" />
                  Price
                  {sortField === 'defaultPrice' && (
                    <ChevronUp
                      className={cn(
                        'size-4 transition-transform',
                        sortDirection === 'desc' && 'rotate-180'
                      )}
                    />
                  )}
                </div>
              </TableHeader>
              <TableHeader
                align="right"
                className="min-w-[100px] cursor-pointer select-none"
                onClick={() => handleSort('quantityOnHand')}
              >
                <div className="flex items-center justify-end gap-2">
                  <Boxes className="size-4 text-zinc-400" />
                  On Hand
                  {sortField === 'quantityOnHand' && (
                    <ChevronUp
                      className={cn(
                        'size-4 transition-transform',
                        sortDirection === 'desc' && 'rotate-180'
                      )}
                    />
                  )}
                </div>
              </TableHeader>
              <TableHeader
                align="right"
                className="min-w-[100px] cursor-pointer select-none"
                onClick={() => handleSort('quantityUsed')}
              >
                <div className="flex items-center justify-end gap-2">
                  <PackageCheck className="size-4 text-zinc-400" />
                  Used
                  {sortField === 'quantityUsed' && (
                    <ChevronUp
                      className={cn(
                        'size-4 transition-transform',
                        sortDirection === 'desc' && 'rotate-180'
                      )}
                    />
                  )}
                </div>
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedItems?.map((item) => (
              <Fragment key={item.id}>
                <TableRow
                  className={cn(
                    'group cursor-pointer transition-colors duration-200',
                    'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                    expandedId === item.id && 'bg-zinc-50 dark:bg-zinc-800/50'
                  )}
                  onClick={() =>
                    setExpandedId(expandedId === item.id ? null : item.id)
                  }
                >
                  <TableCell>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <ChevronRight
                          className={cn(
                            'size-4 transition-transform duration-200',
                            'text-primary-400 group-hover:text-primary-600 dark:text-primary-500 dark:group-hover:text-primary-400',
                            expandedId === item.id && 'rotate-90'
                          )}
                        />
                        <div className="max-w-md ">
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
                          plain
                          onClick={(e: MouseEvent) => {
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
                          plain
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation()
                            if (
                              confirm(
                                'Are you sure you want to delete this item?'
                              )
                            ) {
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
                  </TableCell>

                  <TableCell
                    align="right"
                    className="tabular-nums text-zinc-900 dark:text-zinc-50"
                  >
                    {formatCurrency(item.defaultPrice)}
                  </TableCell>
                  <TableCell
                    align="right"
                    className={cn(
                      'tabular-nums',
                      item.quantityOnHand < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-zinc-900 dark:text-zinc-50'
                    )}
                  >
                    {item.quantityOnHand}
                  </TableCell>
                  <TableCell
                    align="right"
                    className="tabular-nums text-zinc-900 dark:text-zinc-50"
                  >
                    {item.quantityUsed}
                  </TableCell>
                </TableRow>
                {expandedId === item.id && (
                  <TableRow key={`${item.id}-expanded`}>
                    <TableCell
                      colSpan={4}
                      className="animate-in slide-in-from-top duration-200 bg-zinc-50 dark:bg-zinc-800/50"
                    >
                      <ExpandedInfo item={item} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

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
