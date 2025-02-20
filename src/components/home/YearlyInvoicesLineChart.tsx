'use client'

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

export default function YearlyInvoicesLineChart() {
  const { data: rawData, isLoading } = api.invoice.getPastYearTotals.useQuery()

  if (isLoading || !rawData) {
    return (
      <Card>
        <div className="p-6">
          <div className="h-[350px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </Card>
    )
  }

  const startDate = dayjs().subtract(11, 'months').startOf('month')
  const monthsArray = Array.from({ length: 12 }, (_, i) => {
    const date = startDate.add(i, 'months')
    return {
      date: date.format('YYYY-MM'),
      total: 0,
    }
  })

  const data = monthsArray.map((month) => {
    const matchingMonth = rawData.find((d) => d.date === month.date)
    return {
      ...month,
      total: matchingMonth?.total ?? 0,
    }
  })

  return (
    <Card>
      <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Invoice Totals Past 12 Months
        </h2>
      </div>
      <div className="p-4">
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="date"
                tickFormatter={(date) => dayjs(date).format('MMM YYYY')}
                stroke="#71717a"
                fontSize={12}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                stroke="#71717a"
                fontSize={12}
                width={80}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {dayjs(payload[0]?.payload.date).format('MMMM YYYY')}
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(payload[0]?.value as number)}
                        </span>
                      </div>
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}
