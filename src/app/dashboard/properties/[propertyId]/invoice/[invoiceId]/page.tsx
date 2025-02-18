'use client'

import { ChevronRight, Home, Pencil, Plus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useState } from 'react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useForm } from 'react-hook-form'
import { InvoiceDetails } from '~/components/invoice/InvoiceDetails'
import { Button, Card, Spinner } from '~/components/ui'
import {
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
} from '~/components/ui'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui'
import { Select } from '~/components/ui'
import { Input } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
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
  subtotalWithoutManagementFee,
  managementFeeAmount,
  taxAmount,
  totalDue,
  invoice,
}: {
  subtotalWithoutManagementFee: number
  managementFeeAmount: number
  taxAmount: number
  totalDue: number
  invoice: InvoiceWithUser
}) {
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
              <span>{formatCurrency(subtotalWithoutManagementFee)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Management Fee:
              </span>
              <span>{formatCurrency(managementFeeAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Taxes (8.375%):
              </span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <span className="font-medium">Total Due:</span>
              <span className="font-medium">{formatCurrency(totalDue)}</span>
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
                    alt={invoice.createdByName}
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

  if (isLoading) return <Spinner size="lg" />
  if (!invoice || !property) return <div>Invoice not found</div>

  const managementFee = invoice.items?.find(
    (item) => item.customItemName === 'Property Management Fee'
  )
  const managementFeeAmount = managementFee
    ? managementFee.price * managementFee.quantity
    : 0
  const subtotalWithoutManagementFee =
    invoice.items?.reduce((acc, item) => {
      if (item.customItemName !== 'Property Management Fee') {
        return acc + item.price * item.quantity
      }
      return acc
    }, 0) ?? 0
  const taxAmount = subtotalWithoutManagementFee * 0.08375
  const totalDue =
    subtotalWithoutManagementFee + managementFeeAmount + taxAmount

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
                    {dayjs(invoice.invoiceDate).format('MMMM YYYY')}
                  </span>
                </div>
              </h1>
            </div>
            <div className="flex items-center gap-x-4 sm:gap-x-6">
              <Button color="primary">Export</Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 grid-rows-1 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          <InvoiceSummary
            subtotalWithoutManagementFee={subtotalWithoutManagementFee}
            managementFeeAmount={managementFeeAmount}
            taxAmount={taxAmount}
            totalDue={totalDue}
            invoice={invoice}
          />

          <Card className="lg:col-span-2 lg:row-span-2 lg:row-end-2">
            <div className="p-6">
              <InvoiceDetails invoice={invoice} />
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}
