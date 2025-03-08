'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import ReactDatePicker from 'react-datepicker'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '~/components/ui'
import { Combobox, type ComboboxOption } from '~/components/ui/combobox'
import { formatCurrency } from '~/lib/utils/format'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
import { api } from '~/trpc/react'

interface EditItemDialogProps {
  isOpen: boolean
  onClose: () => void
  item: NonNullable<InvoiceWithUser['items']>[number]
  invoiceId: string
  propertyId: string
}

const editItemFormSchema = z
  .object({
    customItemName: z.string().optional(),
    managementGroupItemId: z.string().optional(),
    quantity: z.string().refine((val) => {
      const num = Number(val)
      return !isNaN(num) && num >= 1
    }, 'Quantity must be a number of at least 1'),
    price: z.string().refine((val) => {
      const num = Number(val)
      return !isNaN(num) && num >= 0
    }, 'Price must be a valid non-negative number'),
    date: z.date().nullable().optional(),
  })
  .refine(
    (data) => {
      const hasCustomItem = !!data.customItemName
      const hasManagementItem = !!data.managementGroupItemId
      return hasCustomItem !== hasManagementItem
    },
    {
      message:
        'Must provide either a custom item name or select a supply item, but not both',
    }
  )

export function EditItemDialog({
  isOpen,
  onClose,
  item,
  invoiceId,
  propertyId,
}: EditItemDialogProps) {
  const utils = api.useUtils()
  const { data: items } = api.managementGroupItems.getMany.useQuery()
  const { mutate: updateItem, isPending } = api.invoiceItem.update.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({ propertyId, invoiceId })
      form.reset()
      onClose()
    },
  })

  const form = useForm<z.infer<typeof editItemFormSchema>>({
    resolver: zodResolver(editItemFormSchema),
    defaultValues: {
      customItemName: item.customItemName ?? undefined,
      managementGroupItemId: item.managementGroupItemsId ?? undefined,
      quantity: item.quantity.toString(),
      price: (item.price / 100).toFixed(2),
      date: item.date ?? null,
    },
  })

  const price = form.watch('price')
  const customItemName = form.watch('customItemName')
  const managementGroupItemId = form.watch('managementGroupItemId')

  // Reset the other field when one is set
  useEffect(() => {
    if (customItemName) {
      form.setValue('managementGroupItemId', undefined)
    }
  }, [customItemName, form])

  useEffect(() => {
    if (managementGroupItemId) {
      form.setValue('customItemName', undefined)
      const selectedItem = items?.find((i) => i.id === managementGroupItemId)
      if (selectedItem) {
        form.setValue('price', (selectedItem.defaultPrice / 100).toFixed(2))
      }
    }
  }, [managementGroupItemId, items, form])

  function onSubmit(data: z.infer<typeof editItemFormSchema>) {
    updateItem({
      id: item.id,
      invoiceId,
      customItemName: data.customItemName,
      managementGroupItemId: data.managementGroupItemId,
      quantity: parseInt(data.quantity),
      price: parseFloat(data.price),
      date: data.date ?? null,
    })
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Edit Invoice Item</DialogTitle>
      <DialogDescription>Update the invoice item details.</DialogDescription>

      <DialogBody>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customItemName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Custom Item Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter item name"
                        {...field}
                        value={field.value ?? ''}
                        disabled={!!managementGroupItemId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managementGroupItemId"
                render={({ field, fieldState: { error } }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Select Supply Item</FormLabel>
                    <FormControl>
                      <Combobox
                        value={
                          items?.find((item) => item.id === field.value)
                            ? {
                                id: field.value!,
                                label: items.find(
                                  (item) => item.id === field.value
                                )!.name,
                                price: items.find(
                                  (item) => item.id === field.value
                                )!.defaultPrice,
                              }
                            : null
                        }
                        onChange={(option: ComboboxOption) =>
                          field.onChange(option.id)
                        }
                        options={
                          items?.map((item) => ({
                            id: item.id,
                            label: item.name,
                            price: item.defaultPrice,
                          })) ?? []
                        }
                        disabled={!!customItemName}
                        error={error?.message}
                        placeholder="Search supplies..."
                        renderOption={(option) => (
                          <div className="flex items-center justify-between w-full">
                            <span>{option.label}</span>
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {formatCurrency(option.price)}
                            </span>
                          </div>
                        )}
                        filterFunction={(option, query) =>
                          option.label
                            .toLowerCase()
                            .includes(query.toLowerCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="1"
                        {...field}
                        disabled={!price}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel className={error ? 'text-red-500' : ''}>
                      Price (in dollars)
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center rounded-md bg-white px-3 outline-1 -outline-offset-1 outline-zinc-200 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-primary-600 dark:bg-zinc-950 dark:outline-zinc-800 dark:focus-within:outline-primary-400">
                        <div className="shrink-0 select-none text-base text-zinc-500 dark:text-zinc-400 sm:text-sm/6">
                          $
                        </div>
                        <input
                          type="text"
                          placeholder="0.00"
                          {...field}
                          disabled={!!managementGroupItemId}
                          className="block min-w-0 grow py-1.5 pl-1 pr-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500 sm:text-sm/6"
                        />
                        <div className="shrink-0 select-none text-base text-zinc-500 dark:text-zinc-400 sm:text-sm/6">
                          USD
                        </div>
                      </div>
                    </FormControl>
                    {error && (
                      <FormMessage className="text-red-500">
                        {error.message}
                      </FormMessage>
                    )}
                    <p className="text-xs text-zinc-500">
                      {managementGroupItemId
                        ? 'Price is set by the supply item'
                        : 'Enter the price in dollars (e.g., 10.99)'}
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Date (Optional)</FormLabel>
                    <FormControl>
                      <ReactDatePicker
                        selected={field.value}
                        onChange={(date: Date | null) => field.onChange(date)}
                        dateFormat="MMMM d, yyyy"
                        placeholderText="Select a date"
                        isClearable
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                        wrapperClassName="w-full"
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Show refine error message */}
            {form.formState.errors.root?.message && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/50">
                <p className="text-sm text-red-500 dark:text-red-400">
                  {form.formState.errors.root.message}
                </p>
              </div>
            )}

            <DialogActions>
              <Button type="button" outline onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" color="primary-solid" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogActions>
          </form>
        </Form>
      </DialogBody>
    </Dialog>
  )
}
