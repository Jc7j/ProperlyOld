'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
import { api } from '~/trpc/react'

import { AddItemDialog } from './AddItemDialog'
import { EditItemDialog } from './EditItemDialog'

interface InvoiceDetailsProps {
  invoice: InvoiceWithUser
}

export function InvoiceDetails({ invoice }: InvoiceDetailsProps) {
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const utils = api.useUtils()

  const supplyItems = invoice.items?.filter(
    (item) => item.managementGroupItem !== null
  )

  const maintenanceItems = invoice.items?.filter((item) => item.customItemName)

  const { mutate: deleteItem } = api.invoiceItem.delete.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({
        propertyId: invoice.propertyId!,
        invoiceId: invoice.id,
      })
    },
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

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader className="w-[50%]">Description</TableHeader>
            <TableHeader className="w-[10%] text-center">Quantity</TableHeader>
            <TableHeader className="w-[20%] text-center">Amount</TableHeader>
            <TableHeader className="w-[20%] text-center">Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {/* Maintenance Items Section */}
          {maintenanceItems && maintenanceItems.length > 0 && (
            <>
              <TableRow>
                <TableCell colSpan={4} className="bg-zinc-50 dark:bg-zinc-900">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Maintenance Items
                  </span>
                </TableCell>
              </TableRow>
              {maintenanceItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div>{item.customItemName}</div>
                      {item.date && (
                        <div className="text-sm text-zinc-500">
                          {dayjs(item.date).format('MMM D, YYYY')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-center">
                    {formatCurrency(item.price * item.quantity)}
                  </TableCell>
                  <TableCell className="flex justify-center space-x-2">
                    <Button plain onClick={() => setEditingItem(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      plain
                      onClick={() => {
                        if (
                          confirm('Are you sure you want to delete this item?')
                        ) {
                          deleteItem({
                            id: item.id,
                            invoiceId: invoice.id,
                          })
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </>
          )}

          {/* Supply Items Section */}
          {supplyItems && supplyItems.length > 0 && (
            <>
              <TableRow>
                <TableCell colSpan={4} className="bg-zinc-50 dark:bg-zinc-900">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Supply Items (Taxed at 8.375%)
                  </span>
                </TableCell>
              </TableRow>
              {supplyItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.managementGroupItem?.name}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-center">
                    {formatCurrency(item.price * item.quantity)}
                  </TableCell>
                  <TableCell className="flex justify-center space-x-2">
                    <Button plain onClick={() => setEditingItem(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      plain
                      onClick={() => {
                        if (
                          confirm('Are you sure you want to delete this item?')
                        ) {
                          deleteItem({
                            id: item.id,
                            invoiceId: invoice.id,
                          })
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </>
          )}
        </TableBody>
      </Table>

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
