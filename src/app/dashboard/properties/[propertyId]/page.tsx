'use client'

import { ChevronRight, Home, Pencil, Plus } from 'lucide-react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import DatePicker from 'react-datepicker'
import {
  Button,
  Card,
  ErrorToast,
  Heading,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { api } from '~/trpc/react'

function LocationInfo({ property }: { property: ParsedProperty | null }) {
  return (
    <Card>
      <div className="border-b border-zinc-950/5 px-4 py-3 dark:border-white/5 sm:px-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Location Information
        </h2>
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
    </Card>
  )
}

function OwnerInfo({ property }: { property: ParsedProperty | null }) {
  return (
    <Card>
      <div className="border-b border-zinc-950/5 px-4 py-3 dark:border-white/5 sm:px-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Owner Information
        </h2>
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

function InvoicesHeader({ propertyId }: { propertyId: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Invoices
      </h2>
      <CreateInvoiceButton propertyId={propertyId} />
    </div>
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

export default function PropertyPage() {
  const { propertyId } = useParams<{ propertyId: string }>()
  const { data: property, isLoading } = api.property.getOne.useQuery({
    propertyId,
  })

  if (isLoading) return <Spinner size="lg" />
  if (!property) return <div>Property not found</div>

  return (
    <div className="space-y-6 p-6">
      <Heading level={1}>{property.name}</Heading>

      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<Spinner />}>
          <LocationInfo property={property} />
        </Suspense>

        <Suspense fallback={<Spinner />}>
          <OwnerInfo property={property} />
        </Suspense>
      </div>

      <Card>
        <div className="border-b border-zinc-950/5 px-4 py-3 dark:border-white/5 sm:px-6">
          <InvoicesHeader propertyId={propertyId} />
        </div>
        <div className="p-4 sm:p-6">
          <Suspense fallback={<Spinner />}>
            <InvoicesTable property={property} />
          </Suspense>
        </div>
      </Card>
    </div>
  )
}
