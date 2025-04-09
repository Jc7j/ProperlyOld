'use client'

import { ChevronRight, Home, Pencil, Trash2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import 'react-datepicker/dist/react-datepicker.css'
import { exportInvoiceToPdf } from '~/components/invoice/ExportInvoice'
import { InvoiceDetails } from '~/components/invoice/InvoiceDetails'
import { InvoiceImages } from '~/components/invoice/InvoiceImages'
import { Button, Card, Spinner } from '~/components/ui'
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '~/components/ui'
import { ROUTES } from '~/lib/constants/routes'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
import { type PropertyLocationInfo } from '~/server/api/types'
import { api } from '~/trpc/react'

function Breadcrumb({
  propertyName,
  propertyId,
}: {
  propertyName: string
  propertyId: string
}) {
  const pages = [
    {
      name: 'Properties',
      href: '/dashboard/properties',
      current: false,
    },
    {
      name: propertyName,
      href: `/dashboard/properties/${propertyId}`,
      current: false,
    },
    {
      name: 'Invoice',
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

function InvoiceSummary({
  managementFeeAmount,
  taxAmount,
  totalAmount,
  invoice,
}: {
  managementFeeAmount: number
  taxAmount: number
  totalAmount: number
  invoice: InvoiceWithUser
}) {
  const [isEditingFee, setIsEditingFee] = useState(false)
  const [feeAmount, setFeeAmount] = useState('0')
  const [isSaving, setIsSaving] = useState(false)
  const utils = api.useUtils()

  // Calculate maintenance total separately
  const maintenanceItems =
    invoice.items?.filter(
      (item) => item.customItemName && item.customItemName !== 'Supply Drop Fee'
    ) ?? []

  const maintenanceTotal = maintenanceItems.reduce(
    (total, item) => total + (item.price * item.quantity) / 100,
    0
  )

  // Calculate supply items total
  const supplyItems =
    invoice.items?.filter((item) => !item.customItemName) ?? []
  const suppliesTotal = supplyItems.reduce(
    (total, item) => total + (item.price * item.quantity) / 100,
    0
  )

  // Find existing supply drop fee
  const existingFee = invoice.items?.find(
    (item) => item.customItemName === 'Supply Drop Fee'
  )

  // Set up initial state for the fee
  useEffect(() => {
    if (existingFee) {
      setFeeAmount((existingFee.price / 100).toFixed(2))
    }
  }, [existingFee])

  const { mutate: addItem } = api.invoiceItem.create.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({
        propertyId: invoice.propertyId!,
        invoiceId: invoice.id,
      })
      setIsEditingFee(false)
      setIsSaving(false)
    },
  })

  const { mutate: updateItem } = api.invoiceItem.update.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({
        propertyId: invoice.propertyId!,
        invoiceId: invoice.id,
      })
      setIsEditingFee(false)
      setIsSaving(false)
    },
  })

  const { mutate: deleteItem } = api.invoiceItem.delete.useMutation({
    onSuccess: () => {
      void utils.invoice.getOne.invalidate({
        propertyId: invoice.propertyId!,
        invoiceId: invoice.id,
      })
      setFeeAmount('0')
      setIsEditingFee(false)
      setIsSaving(false)
    },
  })

  const handleSaveFee = () => {
    setIsSaving(true)
    const numericFee = parseFloat(feeAmount)

    if (isNaN(numericFee)) {
      alert('Please enter a valid fee amount')
      setIsSaving(false)
      return
    }

    if (existingFee) {
      // Update existing fee
      updateItem({
        id: existingFee.id,
        invoiceId: invoice.id,
        customItemName: 'Supply Drop Fee',
        price: numericFee,
        quantity: 1,
        date: null,
      })
    } else {
      // Create new fee
      addItem({
        invoiceId: invoice.id,
        customItemName: 'Supply Drop Fee',
        price: numericFee,
        quantity: 1,
        date: null,
      })
    }
  }

  const handleRemoveFee = () => {
    if (!existingFee) return

    if (confirm('Are you sure you want to remove the Supply Drop Fee?')) {
      setIsSaving(true)
      deleteItem({
        id: existingFee.id,
        invoiceId: invoice.id,
      })
    }
  }

  return (
    <Card className="lg:col-start-3 lg:row-end-1">
      <dl className="flex flex-wrap">
        <div className="flex-auto p-6">
          <dt className="text-sm/6 font-semibold text-zinc-900 dark:text-zinc-50">
            Summary
          </dt>
          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Supplies Total:
              </span>
              <span>{formatCurrency(suppliesTotal * 100)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Maintenance Total:
              </span>
              <span>{formatCurrency(maintenanceTotal * 100)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                Supply Drop Fee
                {!isEditingFee && (
                  <button
                    onClick={() => setIsEditingFee(true)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-xs text-primary-600 hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-800/40"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
              {isEditingFee ? (
                <div className="flex items-center gap-2 py-2 px-3 -my-2 -mr-3 bg-primary-50/70 dark:bg-primary-950/20 rounded-lg border border-primary-100 dark:border-primary-900/30 shadow-sm">
                  <div className="relative rounded-md overflow-hidden">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-primary-600 dark:text-primary-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      className="block w-24 rounded-md border-0 py-1.5 pl-6 pr-1 text-sm text-zinc-900 ring-1 ring-inset ring-primary-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-primary-500 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-primary-800 dark:focus:ring-primary-500"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={handleSaveFee}
                      disabled={isSaving}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-100 text-primary-600 hover:bg-primary-200 disabled:opacity-50 dark:bg-primary-900/50 dark:text-primary-400 dark:hover:bg-primary-800/70"
                      title="Save"
                    >
                      {isSaving ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                    {existingFee && (
                      <button
                        onClick={handleRemoveFee}
                        disabled={isSaving}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                        title="Remove fee"
                      >
                        {isSaving ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setIsEditingFee(false)}
                      disabled={isSaving}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      title="Cancel"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <span
                  className={`${managementFeeAmount > 0 ? 'font-medium text-primary-600 dark:text-primary-400' : ''}`}
                >
                  {formatCurrency(managementFeeAmount)}
                </span>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Taxes (8.375%):
              </span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <span className="font-medium">Total Due:</span>
              <span className="font-medium">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>
        <div className="w-full border-t border-zinc-200 dark:border-zinc-800">
          <div className="p-6">
            <dt className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Created by
            </dt>
            <dd className="flex items-center gap-3">
              {invoice.createdByImageUrl && (
                <div className="relative">
                  <Image
                    src={invoice.createdByImageUrl}
                    alt={invoice.createdByName ?? ''}
                    width={32}
                    height={32}
                    className="rounded-full ring-2 ring-white dark:ring-zinc-900"
                  />
                  <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-green-400 dark:border-zinc-900" />
                </div>
              )}
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {invoice.createdByName}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {dayjs(invoice.createdAt).format('MMM D, YYYY [at] h:mm A')}
                </p>
              </div>
            </dd>
          </div>
        </div>
      </dl>
    </Card>
  )
}

function DeleteInvoiceDialog({
  isOpen,
  onClose,
  invoiceId,
  propertyId,
}: {
  isOpen: boolean
  onClose: () => void
  invoiceId: string
  propertyId: string
}) {
  const router = useRouter()
  const utils = api.useUtils()
  const { mutate: deleteInvoice, isPending } = api.invoice.delete.useMutation({
    onSuccess: () => {
      void utils.property.getOne.invalidate({ propertyId })
      router.push(ROUTES.DASHBOARD.PROPERTY.replace(':propertyId', propertyId))
      onClose()
    },
  })

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>Delete Invoice</DialogTitle>
      <DialogDescription>
        Are you sure you want to delete this invoice? This action cannot be
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
            onClick={() => deleteInvoice({ invoiceId, propertyId })}
          >
            {isPending ? 'Deleting...' : 'Delete Invoice'}
          </Button>
        </DialogActions>
      </DialogBody>
    </Dialog>
  )
}

export default function InvoicePage() {
  const params = useParams<{
    propertyId: string // property id
    invoiceId: string
  }>()

  const { data: property } = api.property.getOne.useQuery({
    propertyId: params.propertyId,
  })

  const { data: invoice, isLoading } = api.invoice.getOne.useQuery({
    invoiceId: params.invoiceId,
    propertyId: params.propertyId,
  })

  const [isDeleting, setIsDeleting] = useState(false)

  if (isLoading) return <Spinner size="lg" />
  if (!invoice || !property) return <div>Invoice not found</div>

  const { managementFeeAmount, taxAmount, totalAmount } =
    invoice.financialDetails ?? {
      managementFeeAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
    }

  return (
    <main>
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
          <Breadcrumb
            propertyName={property.name}
            propertyId={params.propertyId}
          />

          <div className="mx-auto mt-8 flex max-w-2xl items-center justify-between gap-x-8 lg:mx-0 lg:max-w-none">
            <div className="flex items-center gap-x-6">
              <h1>
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Invoice for
                </div>
                <div className="mt-2 flex items-center gap-x-3">
                  <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    {property.name}
                  </span>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {dayjs(invoice.invoiceDate).format('MMM YYYY')}
                  </span>
                </div>
              </h1>
            </div>
            <div className="flex items-center gap-x-4 sm:gap-x-6">
              <Button
                color="primary"
                onClick={() =>
                  exportInvoiceToPdf({
                    invoice,
                    propertyName: property.name,
                    propertyLocation:
                      property.locationInfo as unknown as PropertyLocationInfo,
                    ownerInfo: {
                      name: property.owner?.name ?? '',
                      email: property.owner?.email ?? '',
                      phone: property.owner?.phone ?? '',
                    },
                  })
                }
              >
                Export
              </Button>
              <Button
                color="destructive-outline"
                onClick={() => setIsDeleting(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 grid-rows-1 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          <InvoiceSummary
            managementFeeAmount={managementFeeAmount ?? 0}
            taxAmount={taxAmount ?? 0}
            totalAmount={totalAmount ?? 0}
            invoice={invoice}
          />

          <div className="lg:col-span-2 lg:row-span-2 lg:row-end-2">
            <div className="space-y-8">
              <Card>
                <div className="p-6">
                  <InvoiceDetails invoice={invoice} />
                </div>
              </Card>

              <InvoiceImages invoice={invoice} propertyId={params.propertyId} />
            </div>
          </div>
        </div>
      </div>

      {isDeleting && (
        <DeleteInvoiceDialog
          isOpen={isDeleting}
          onClose={() => setIsDeleting(false)}
          invoiceId={params.invoiceId}
          propertyId={params.propertyId}
        />
      )}
    </main>
  )
}
