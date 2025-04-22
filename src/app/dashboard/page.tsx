import RecentInvoices from '~/components/home/RecentInvoices'
import YearlyInvoicesLineChart from '~/components/home/YearlyInvoicesLineChart'
import { Card } from '~/components/ui'

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
      </div>

      <div className="space-y-8">
        <YearlyInvoicesLineChart />

        <Card>
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
              Recent Invoices
            </h2>
          </div>
          <RecentInvoices />
        </Card>
      </div>
    </main>
  )
}
