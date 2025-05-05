'use client'

import { useMemo, useState } from 'react'
import DatePicker from '~/components/DatePicker'
import MonthlyOverview from '~/components/dashboard/MonthlyOverview'
import YearlyInvoicesLineChart from '~/components/home/YearlyInvoicesLineChart'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

export default function DashboardPage() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  // Format date as YYYY-MM for API queries
  const monthQuery = useMemo(() => {
    if (!date) return undefined
    return dayjs(date).format('YYYY-MM')
  }, [date])

  // Fetch combined data for the selected month using the new route
  const monthlyOverviewData = api.property.getManyMonthlyOverview.useQuery(
    { month: monthQuery! }, // Use non-null assertion as enabled is set
    {
      enabled: !!monthQuery, // Only run query when monthQuery is available
      staleTime: 5 * 60 * 1000, // Optional: Cache for 5 minutes
    }
  )

  // Check if data is still loading
  const isLoading = monthlyOverviewData.isLoading

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Overview of your recent activity
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <YearlyInvoicesLineChart />

        {/* Monthly Overview Table */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Monthly Property Statements
            </h2>
            <div className="w-48">
              <DatePicker
                selected={date}
                onChange={(date) => setDate(date ?? undefined)}
                showMonthYearPicker
              />
            </div>
          </div>
          {monthlyOverviewData.data ? (
            <MonthlyOverview
              date={date}
              monthQuery={monthQuery}
              isLoading={isLoading}
              // Pass the combined data directly
              monthlyData={monthlyOverviewData.data}
            />
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Select a month to view property data
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
