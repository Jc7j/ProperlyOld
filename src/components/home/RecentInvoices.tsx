'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '~/components/ui'
import { ROUTES } from '~/lib/constants/routes'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

export default function RecentInvoices() {
  const { data: invoices, isLoading } = api.invoice.getMany.useQuery({
    limit: 10,
  })

  if (isLoading) return <Spinner />
  if (!invoices?.length) {
    return (
      <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        No invoices found
      </div>
    )
  }

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {invoices.map((invoice) => (
        <Link
          key={invoice.id}
          href={ROUTES.DASHBOARD.INVOICE.replace(
            ':propertyId',
            invoice.propertyId ?? ''
          ).replace(':invoiceId', invoice.id)}
          className="flex items-center justify-between p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {invoice.property?.name ?? 'Unknown Property'}
              </span>
              <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {dayjs(invoice.invoiceDate).format('MMM YYYY')}
              </span>
            </div>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {invoice.property?.locationInfo?.address ??
                'No address available'}
            </div>
          </div>
          <div className="ml-4 flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {formatCurrency(invoice.financialDetails?.totalAmount ?? 0)}
            </span>
            <ChevronRight className="size-4 text-zinc-400" />
          </div>
        </Link>
      ))}
    </div>
  )
}
