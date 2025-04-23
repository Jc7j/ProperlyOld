'use client'

import MonthlyOverviewDialog from '~/components/dashboard/MonthlyOverviewDialog'
import YearlyInvoicesLineChart from '~/components/home/YearlyInvoicesLineChart'

export default function DashboardPage() {
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
        <MonthlyOverviewDialog />
      </div>

      <div className="space-y-8">
        <YearlyInvoicesLineChart />
      </div>
    </main>
  )
}
