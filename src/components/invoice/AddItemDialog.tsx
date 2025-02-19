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
  Select,
} from '~/components/ui'
import { cn } from '~/lib/utils/cn'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

interface AddItemDialogProps {
  isOpen: boolean
  onClose: () => void
  propertyId: string
  invoiceId: string
}

// Create a form schema based on the API schema
const addItemFormSchema = z
  .object({
    customItemName: z.string().optional(),
    managementGroupItemId: z.string().optional(),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    price: z.number().min(0, 'Price must be non-negative'),
    date: z.date().optional(),
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

export function AddItemDialog({
  isOpen,
  onClose,
  propertyId,
  invoiceId,
}: AddItemDialogProps) {
  const utils = api.useUtils()
  const { data: items } = api.managementGroupItems.getMany.useQuery()
  const { mutate: addItem, isPending } = api.invoiceItem.create.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({ propertyId, invoiceId })
      form.reset()
      onClose()
    },
  })

  const form = useForm<z.infer<typeof addItemFormSchema>>({
    resolver: zodResolver(addItemFormSchema),
    defaultValues: {
      quantity: 1,
      price: 0,
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
        form.setValue('price', selectedItem.defaultPrice / 100)
      }
    }
  }, [managementGroupItemId, items, form])

  function onSubmit(data: z.infer<typeof addItemFormSchema>) {
    addItem({
      invoiceId,
      customItemName: data.customItemName,
      managementGroupItemId: data.managementGroupItemId,
      quantity: data.quantity,
      price: data.price,
      date: data.date,
    })
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Add Invoice Item</DialogTitle>
      <DialogDescription>
        Add a custom item or select from your supplies.
      </DialogDescription>

      <DialogBody>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customItemName"
                render={({ field, fieldState: { error } }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className={error ? 'text-red-500' : ''}>
                      Custom Item Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter item name"
                        {...field}
                        value={field.value ?? ''}
                        disabled={!!managementGroupItemId}
                        className={error ? 'border-red-500' : ''}
                      />
                    </FormControl>
                    {error && (
                      <FormMessage className="text-red-500">
                        {error.message}
                      </FormMessage>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managementGroupItemId"
                render={({ field, fieldState: { error } }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className={error ? 'text-red-500' : ''}>
                      Select Supply Item
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ''}
                        disabled={!!customItemName}
                        onChange={(e) => field.onChange(e.target.value)}
                        className={cn('w-full', error && 'border-red-500')}
                      >
                        <option value="">Select an item</option>
                        {items?.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {formatCurrency(item.defaultPrice)}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    {error && (
                      <FormMessage className="text-red-500">
                        {error.message}
                      </FormMessage>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel className={error ? 'text-red-500' : ''}>
                      Quantity
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        {...field}
                        value={field.value}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(value === '' ? 1 : parseInt(value))
                        }}
                        disabled={!price}
                        className={error ? 'border-red-500' : ''}
                      />
                    </FormControl>
                    {error && (
                      <FormMessage className="text-red-500">
                        {error.message}
                      </FormMessage>
                    )}
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
                      <div
                        className={cn(
                          'flex items-center rounded-md bg-white px-3 outline-1 -outline-offset-1 outline-zinc-200 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-primary-600 dark:bg-zinc-950 dark:outline-zinc-800 dark:focus-within:outline-primary-400',
                          managementGroupItemId && 'opacity-50'
                        )}
                      >
                        <div className="shrink-0 select-none text-base text-zinc-500 dark:text-zinc-400 sm:text-sm/6">
                          $
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={
                            field.value === 0 ? '' : field.value.toFixed(2)
                          }
                          onChange={(e) => {
                            const value = e.target.value
                            const numValue =
                              value === '' ? 0 : parseFloat(value)
                            field.onChange(Math.round(numValue * 100) / 100)
                          }}
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
                {isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </DialogActions>
          </form>
        </Form>
      </DialogBody>
    </Dialog>
  )
}
