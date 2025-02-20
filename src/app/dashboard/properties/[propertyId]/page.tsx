'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ChevronRight, Home } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import DatePicker from 'react-datepicker'
import { useForm } from 'react-hook-form'
import { type z } from 'zod'
import PlacesAutocomplete from '~/components/google/PlacesAutocomplete'
import {
  Button,
  Card,
  ErrorToast,
  Heading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui'
import {
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover'
import { ROUTES } from '~/lib/constants/routes'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { type ParsedProperty } from '~/server/api/routers/property'
import {
  type editLocationSchema,
  type editOwnerSchema,
} from '~/server/api/routers/property'
import { api } from '~/trpc/react'

function EditNameDialog({
  isOpen,
  onClose,
  property,
}: {
  isOpen: boolean
  onClose: () => void
  property: ParsedProperty
}) {
  const utils = api.useUtils()
  const { mutate: editName, isPending } = api.property.editName.useMutation({
    onSuccess: () => {
      void utils.property.getOne.invalidate()
      form.reset()
      onClose()
    },
  })

  const form = useForm<{ propertyId: string; name: string }>({
    defaultValues: {
      propertyId: property.id,
      name: property.name,
    },
  })

  function onSubmit(data: { propertyId: string; name: string }) {
    editName(data)
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Edit Property Name</DialogTitle>
      <DialogDescription>Update the property name.</DialogDescription>

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
                    <Input placeholder="Enter property name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

function EditLocationDialog({
  isOpen,
  onClose,
  property,
}: {
  isOpen: boolean
  onClose: () => void
  property: ParsedProperty
}) {
  const utils = api.useUtils()
  const { mutate: editLocation, isPending } =
    api.property.editLocation.useMutation({
      onSuccess: () => {
        void utils.property.getOne.invalidate()
        form.reset()
        onClose()
      },
    })

  const form = useForm<z.infer<typeof editLocationSchema>>({
    defaultValues: {
      propertyId: property.id,
      address: property.locationInfo?.address ?? undefined,
      city: property.locationInfo?.city ?? undefined,
      state: property.locationInfo?.state ?? undefined,
      postalCode: property.locationInfo?.postalCode ?? undefined,
    },
  })

  function handlePlaceSelect(
    place: google.maps.places.PlaceResult,
    e?: React.SyntheticEvent
  ) {
    e?.preventDefault()

    const addressComponents = place.address_components ?? []
    const streetNumber = addressComponents.find((c) =>
      c.types.includes('street_number')
    )?.long_name
    const route = addressComponents.find((c) =>
      c.types.includes('route')
    )?.long_name
    const city = addressComponents.find(
      (c) => c.types.includes('locality') || c.types.includes('sublocality')
    )?.long_name
    const state = addressComponents.find((c) =>
      c.types.includes('administrative_area_level_1')
    )?.short_name
    const postalCode = addressComponents.find((c) =>
      c.types.includes('postal_code')
    )?.long_name

    form.setValue(
      'address',
      streetNumber && route
        ? `${streetNumber} ${route}`
        : (place.formatted_address ?? '')
    )
    if (city) form.setValue('city', city)
    if (state) form.setValue('state', state)
    if (postalCode) form.setValue('postalCode', postalCode)
  }

  function onSubmit(data: z.infer<typeof editLocationSchema>) {
    const cleanedData = {
      ...data,
      address: data.address ?? undefined,
      city: data.city ?? undefined,
      state: data.state ?? undefined,
      postalCode: data.postalCode ?? undefined,
    }
    editLocation(cleanedData)
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Edit Location</DialogTitle>
      <DialogDescription>
        Update the property location details.
      </DialogDescription>

      <DialogBody>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <PlacesAutocomplete
                      onPlaceSelect={handlePlaceSelect}
                      placeholder="Search for address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter city"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter state"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter postal code"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

function EditOwnerDialog({
  isOpen,
  onClose,
  property,
}: {
  isOpen: boolean
  onClose: () => void
  property: ParsedProperty
}) {
  const utils = api.useUtils()
  const { mutate: editOwner, isPending } = api.property.editOwner.useMutation({
    onSuccess: () => {
      void utils.property.getOne.invalidate()
      form.reset()
      onClose()
    },
  })

  const form = useForm<z.infer<typeof editOwnerSchema>>({
    defaultValues: {
      propertyId: property.id,
      name: property.owner?.name ?? '',
      email: property.owner?.email ?? '',
      phone: property.owner?.phone ?? '',
    },
  })

  function onSubmit(data: z.infer<typeof editOwnerSchema>) {
    editOwner(data)
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Edit Owner</DialogTitle>
      <DialogDescription>Update the property owner details.</DialogDescription>

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
                    <Input placeholder="Enter owner name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter owner email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Enter owner phone"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

function LocationInfo({ property }: { property: ParsedProperty | null }) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-zinc-950/5 px-4 py-3 dark:border-white/5 sm:px-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Address
        </h2>
        <Button plain onClick={() => setIsEditing(true)}>
          <Pencil className="size-4" />
        </Button>
      </div>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-neutral-500">Address</dt>
            <dd className="text-sm">
              {property?.locationInfo?.address ?? 'n/a'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">City</dt>
            <dd className="text-sm">{property?.locationInfo?.city ?? 'n/a'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">State</dt>
            <dd className="text-sm">
              {property?.locationInfo?.state ?? 'n/a'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">
              Postal Code
            </dt>
            <dd className="text-sm">
              {property?.locationInfo?.postalCode ?? 'n/a'}
            </dd>
          </div>
        </div>
      </div>
      {property && (
        <EditLocationDialog
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          property={property}
        />
      )}
    </Card>
  )
}

function OwnerInfo({ property }: { property: ParsedProperty | null }) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-zinc-950/5 px-4 py-3 dark:border-white/5 sm:px-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Owner
        </h2>
        <Button plain onClick={() => setIsEditing(true)}>
          <Pencil className="size-4" />
        </Button>
      </div>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-neutral-500">Name</dt>
            <dd className="text-sm">{property?.owner?.name ?? 'n/a'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Email</dt>
            <dd className="text-sm">{property?.owner?.email ?? 'n/a'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Phone</dt>
            <dd className="text-sm">{property?.owner?.phone ?? 'n/a'}</dd>
          </div>
        </div>
      </div>
      {property && (
        <EditOwnerDialog
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          property={property}
        />
      )}
    </Card>
  )
}

function CreateInvoiceButton({ propertyId }: { propertyId: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>()
  const router = useRouter()
  const createInvoice = api.invoice.create.useMutation({
    onSuccess: async (newInvoice) => {
      router.push(
        ROUTES.DASHBOARD.INVOICE.replace(':propertyId', propertyId).replace(
          ':invoiceId',
          newInvoice
        )
      )
    },
    onError: (error) => {
      console.error(error)
      ErrorToast(
        'Failed to create invoice. Contact support if the problem persists.'
      )
    },
  })

  return (
    <Popover>
      <PopoverTrigger buttonColor="primary">
        <Plus className="h-4 w-4" />
        <span>New Invoice</span>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72">
        <div className="border-b border-zinc-200 p-3 dark:border-zinc-700">
          <h3 className="text-sm font-medium">Select Invoice Month</h3>
        </div>
        <div className="p-3">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date ?? undefined)}
            dateFormat="MMMM yyyy"
            showMonthYearPicker
            showFullMonthYearPicker
            showFourColumnMonthYearPicker
            inline
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
          <Button
            className="w-full"
            disabled={!selectedDate || createInvoice.isPending}
            onClick={() => {
              if (selectedDate) {
                createInvoice.mutate({
                  propertyId,
                  invoiceDate: selectedDate,
                })
              }
            }}
          >
            Create Invoice
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function InvoicesTable({
  property,
}: {
  property: NonNullable<ParsedProperty>
}) {
  const router = useRouter()

  if (!property.invoices?.length) {
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
        <h3 className="mt-2 text-sm font-semibold">No invoices</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Get started by creating a new invoice.
        </p>
        <div className="mt-6">
          <CreateInvoiceButton propertyId={property.id} />
        </div>
      </div>
    )
  }

  return (
    <Table striped>
      <TableHead>
        <TableRow>
          <TableHeader>Date</TableHeader>
          <TableHeader align="right">Total</TableHeader>
          <TableHeader align="right">Updated by</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {property.invoices.map((invoice) => (
          <TableRow
            key={invoice.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => {
              router.push(
                ROUTES.DASHBOARD.INVOICE.replace(
                  ':propertyId',
                  property.id
                ).replace(':invoiceId', invoice.id)
              )
            }}
          >
            <TableCell>
              {dayjs(invoice.invoiceDate).format('MMMM YYYY')}
            </TableCell>
            <TableCell align="right">
              {formatCurrency(invoice.financialDetails?.totalAmount ?? 0)}
            </TableCell>
            <TableCell align="right">
              <div className="flex items-center justify-end gap-3">
                {invoice.updatedByImageUrl && (
                  <Image
                    src={invoice.updatedByImageUrl}
                    alt={invoice.updatedByName}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                )}
                <div className="space-y-1 text-sm">
                  <p className="text-neutral-500">{invoice.updatedByName}</p>
                  <p className="text-neutral-500">
                    {dayjs(invoice.updatedAt).format('MMM D, YYYY')}
                  </p>
                </div>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Breadcrumb({ propertyName }: { propertyName: string }) {
  const pages = [
    {
      name: 'Properties',
      href: '/dashboard/properties',
      current: false,
    },
    {
      name: propertyName,
      href: '#',
      current: true,
    },
  ]

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol role="list" className="flex items-center space-x-4">
        <li>
          <div>
            <Link
              href="/dashboard"
              className="text-zinc-400 transition-colors hover:text-zinc-500 dark:text-zinc-500 dark:hover:text-zinc-400"
            >
              <Home className="size-5 shrink-0" />
              <span className="sr-only">Dashboard</span>
            </Link>
          </div>
        </li>
        {pages.map((page) => (
          <li key={page.name}>
            <div className="flex items-center">
              <ChevronRight
                className="size-5 shrink-0 text-zinc-400 dark:text-zinc-600"
                aria-hidden="true"
              />
              <Link
                href={page.href}
                aria-current={page.current ? 'page' : undefined}
                className={`ml-4 text-sm font-medium ${
                  page.current
                    ? 'text-zinc-800 dark:text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                }`}
              >
                {page.name}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function DeletePropertyDialog({
  isOpen,
  onClose,
  propertyId,
}: {
  isOpen: boolean
  onClose: () => void
  propertyId: string
}) {
  const router = useRouter()
  const utils = api.useUtils()
  const { mutate: deleteProperty, isPending } = api.property.delete.useMutation(
    {
      onSuccess: () => {
        void utils.property.getMany.invalidate()
        router.push(ROUTES.DASHBOARD.PROPERTIES)
        onClose()
      },
    }
  )

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Delete Property</DialogTitle>
      <DialogDescription>
        Are you sure you want to delete this property? This action cannot be
        undone.
      </DialogDescription>

      <DialogBody>
        <DialogActions>
          <Button type="button" outline onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="destructive-outline"
            disabled={isPending}
            onClick={() => deleteProperty({ propertyId })}
          >
            {isPending ? 'Deleting...' : 'Delete Property'}
          </Button>
        </DialogActions>
      </DialogBody>
    </Dialog>
  )
}

function PropertyHeader({ property }: { property: ParsedProperty }) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  return (
    <header className="relative isolate">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-16 top-full -mt-16 transform-gpu opacity-50 blur-3xl xl:left-1/2 xl:-ml-80">
          <div className="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-[#FF80B5] to-[#9089FC]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-900/5 dark:bg-white/5" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-20 sm:px-6 lg:px-8">
        <Breadcrumb propertyName={property.name} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heading level={1}>{property.name}</Heading>
            <Button plain onClick={() => setIsEditingName(true)}>
              <Pencil className="size-4" />
            </Button>
          </div>
          <Button
            color="destructive-outline"
            onClick={() => setIsDeleting(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {isEditingName && (
        <EditNameDialog
          isOpen={isEditingName}
          onClose={() => setIsEditingName(false)}
          property={property}
        />
      )}

      {isDeleting && (
        <DeletePropertyDialog
          isOpen={isDeleting}
          onClose={() => setIsDeleting(false)}
          propertyId={property.id}
        />
      )}
    </header>
  )
}

function PropertyInfoSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid animate-pulse gap-4">
        <div className="h-6 w-32 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="space-y-3">
          <div className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function InvoicesTableSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <div className="h-6 w-24 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="grid animate-pulse gap-4 p-4">
        <div className="space-y-3">
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

function PropertyContent({ propertyId }: { propertyId: string }) {
  const { data: property, isLoading } = api.property.getOne.useQuery({
    propertyId,
  })

  if (isLoading) {
    return (
      <>
        <div className="grid gap-6 md:grid-cols-2">
          <PropertyInfoSkeleton />
          <PropertyInfoSkeleton />
        </div>
        <InvoicesTableSkeleton />
      </>
    )
  }

  if (!property) return <div>Property not found</div>

  return (
    <>
      <PropertyHeader property={property} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Suspense fallback={<PropertyInfoSkeleton />}>
            <LocationInfo property={property} />
          </Suspense>

          <Suspense fallback={<PropertyInfoSkeleton />}>
            <OwnerInfo property={property} />
          </Suspense>
        </div>

        <Card className="mt-6">
          <div className="border-b border-zinc-950/5 px-4 py-3 dark:border-white/5 sm:px-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Invoices
              </h2>
              <CreateInvoiceButton propertyId={propertyId} />
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <Suspense fallback={<InvoicesTableSkeleton />}>
              <InvoicesTable property={property} />
            </Suspense>
          </div>
        </Card>
      </div>
    </>
  )
}

export default function PropertyPage() {
  const { propertyId } = useParams<{ propertyId: string }>()

  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <>
            <header className="relative isolate">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 overflow-hidden"
              >
                <div className="absolute left-16 top-full -mt-16 transform-gpu opacity-50 blur-3xl xl:left-1/2 xl:-ml-80">
                  <div className="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-[#FF80B5] to-[#9089FC]" />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-900/5 dark:bg-white/5" />
              </div>

              <div className="mx-auto max-w-7xl px-4 pb-12 pt-20 sm:px-6 lg:px-8">
                <Breadcrumb propertyName="Loading..." />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            </header>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid gap-6 md:grid-cols-2">
                <PropertyInfoSkeleton />
                <PropertyInfoSkeleton />
              </div>
              <InvoicesTableSkeleton />
            </div>
          </>
        }
      >
        <PropertyContent propertyId={propertyId} />
      </Suspense>
    </div>
  )
}
