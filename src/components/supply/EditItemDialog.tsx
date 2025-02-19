'use client'

import { useForm } from 'react-hook-form'
import { type z } from 'zod'
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
import {
  type ManagementGroupItemWithUser,
  type editItemSchema,
} from '~/server/api/routers/managementGroupItems'
import { api } from '~/trpc/react'

export default function EditItemDialog({
  isOpen,
  onClose,
  item,
}: {
  isOpen: boolean
  onClose: () => void
  item: ManagementGroupItemWithUser
}) {
  const utils = api.useUtils()
  const { mutate: editItem, isPending } =
    api.managementGroupItems.edit.useMutation({
      onSuccess: () => {
        void utils.managementGroupItems.getMany.invalidate()
        form.reset()
        onClose()
      },
    })

  const form = useForm<
    Omit<z.infer<typeof editItemSchema>, 'defaultPrice'> & {
      defaultPrice: number
    }
  >({
    defaultValues: {
      id: item.id,
      name: item.name,
      defaultPrice: item.defaultPrice / 100,
      description: item.description ?? '',
      link: item.link ?? '',
    },
  })

  function onSubmit(data: z.infer<typeof editItemSchema>) {
    editItem(data)
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Edit Supply Item</DialogTitle>
      <DialogDescription>Update the item details.</DialogDescription>

      <DialogBody>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter item name"
                      {...field}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <div className="flex items-center rounded-md bg-white px-3 outline-1 -outline-offset-1 outline-zinc-200 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-primary-600 dark:bg-zinc-950 dark:outline-zinc-800 dark:focus-within:outline-primary-400">
                      <div className="shrink-0 select-none text-base text-zinc-500 dark:text-zinc-400 sm:text-sm/6">
                        $
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value === 0 ? '' : field.value.toFixed(2)}
                        onChange={(e) => {
                          const value = e.target.value
                          const numValue = value === '' ? 0 : parseFloat(value)
                          field.onChange(Math.round(numValue * 100) / 100)
                        }}
                        className="block min-w-0 grow py-1.5 pl-1 pr-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-500 sm:text-sm/6"
                      />
                      <div className="shrink-0 select-none text-base text-zinc-500 dark:text-zinc-400 sm:text-sm/6">
                        USD
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter item description"
                      {...field}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://"
                      {...field}
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogActions>
              <Button
                type="button"
                outline
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="primary-solid"
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogActions>
          </form>
        </Form>
      </DialogBody>
    </Dialog>
  )
}
