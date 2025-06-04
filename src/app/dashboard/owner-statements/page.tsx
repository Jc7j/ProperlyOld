'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import DatePicker from '~/components/DatePicker'
import ExportMonthlyIndividualStatements from '~/components/owner-statement/ExportMonthlyIndividualStatements'
import ExportMonthlyStatements from '~/components/owner-statement/ExportMonthlyStatements'
import MonthlyImportModal from '~/components/owner-statement/MonthlyImportModal'
import OwnerStatementContent from '~/components/owner-statement/OwnerStatementContent'
import { Button, Heading, Input } from '~/components/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { cn } from '~/lib/utils/cn'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

export default function OwnerStatementsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get selected date from URL or default to current date
  const monthParam = searchParams.get('month')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    return monthParam ? new Date(`${monthParam}-01`) : new Date()
  })

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Calculate month query from selected date
  const monthQuery = useMemo(() => {
    if (!selectedDate) return undefined
    return dayjs(selectedDate).format('YYYY-MM')
  }, [selectedDate])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isExportSummaryDialogOpen, setIsExportSummaryDialogOpen] =
    useState(false)
  const [isExportAllIndividualDialogOpen, setIsExportAllIndividualDialogOpen] =
    useState(false)
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(
    null
  )

  useEffect(() => {
    const statementId = searchParams.get('statement')
    if (statementId) {
      setSelectedStatementId(statementId)
    }
  }, [searchParams])

  // Update URL when statement is selected
  const handleSelectStatement = (statementId: string | null) => {
    setSelectedStatementId(statementId)
    const params = new URLSearchParams(searchParams.toString())

    if (statementId) {
      params.set('statement', statementId)
    } else {
      params.delete('statement')
    }

    router.push(`/dashboard/owner-statements?${params.toString()}`)
  }

  // Update URL and state when month changes
  const handleMonthChange = (date: Date | null) => {
    setSelectedDate(date ?? undefined)

    const params = new URLSearchParams(searchParams.toString())

    if (date) {
      params.set('month', dayjs(date).format('YYYY-MM'))
    } else {
      params.delete('month')
    }

    // Clear selected statement when changing months
    params.delete('statement')
    setSelectedStatementId(null)

    router.push(`/dashboard/owner-statements?${params.toString()}`)
  }

  // Use the month query for the API call
  const {
    data: ownerStatements,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = api.ownerStatement.getMany.useQuery(
    { month: monthQuery! },
    { enabled: !!monthQuery }
  )

  // Filter statements based on search query
  const filteredStatements = useMemo(() => {
    if (!ownerStatements || !searchQuery.trim()) {
      return ownerStatements ?? []
    }

    const query = searchQuery.toLowerCase().trim()
    return ownerStatements.filter((statement) =>
      statement.property?.name?.toLowerCase().includes(query)
    )
  }, [ownerStatements, searchQuery])

  const handleOpenImportModal = () => {
    setIsModalOpen(true)
  }

  const handleCloseImportModal = () => {
    setIsModalOpen(false)
    void refetch()
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Sidebar - Statement List */}
      <div
        className={cn(
          'w-full md:w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full overflow-hidden',
          selectedStatementId && 'hidden md:flex'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <Heading level={2} className="text-lg font-semibold">
              Owner Statements
            </Heading>
            {selectedDate && (
              <div className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                {dayjs(selectedDate).format('MMM YYYY')}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <DatePicker
              selected={selectedDate}
              onChange={handleMonthChange}
              showMonthYearPicker
              placeholderText="Filter by month"
              isClearable
              className="w-full"
            />

            {/* Search Input */}
            <Input
              type="text"
              placeholder="Search by property name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm"
            />

            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 text-xs">
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setIsExportSummaryDialogOpen(true)}
                  >
                    Monthly Summary
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsExportAllIndividualDialogOpen(true)}
                  >
                    All Statements
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="default"
                onClick={handleOpenImportModal}
                className="flex-1 text-xs"
              >
                Create New
              </Button>
            </div>
          </div>
        </div>

        {/* Statement List */}
        <div className="flex-1 overflow-y-auto">
          {isError && (
            <div className="p-4 text-sm text-red-600">
              Error: {queryError?.message ?? 'Unknown error'}
            </div>
          )}

          {isLoading && !isError && (
            <div className="p-4 text-sm text-muted-foreground">
              Loading statements...
            </div>
          )}

          {!isLoading && !isError && !filteredStatements?.length && (
            <div className="p-4 text-sm text-muted-foreground">
              {searchQuery.trim()
                ? `No statements found matching "${searchQuery}"`
                : 'No statements found.'}
            </div>
          )}

          {!isLoading &&
            !isError &&
            filteredStatements &&
            filteredStatements.length > 0 && (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredStatements.map((statement) => (
                  <div
                    key={statement.id}
                    className={cn(
                      'p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors',
                      selectedStatementId === statement.id &&
                        'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500'
                    )}
                    onClick={() => handleSelectStatement(statement.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-sm">
                        {statement.property?.name ?? 'Unknown Property'}
                      </h3>
                      <div className="text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                        {dayjs(statement.statementMonth).format('MMM YYYY')}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Income</span>
                        <span>
                          {formatCurrency(statement.totalIncome, 'USD', {
                            centsToDollars: false,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Expenses</span>
                        <span>
                          {formatCurrency(statement.totalExpenses, 'USD', {
                            centsToDollars: false,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Adjustments</span>
                        <span>
                          {formatCurrency(statement.totalAdjustments, 'USD', {
                            centsToDollars: false,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-medium pt-1 border-t border-zinc-200 dark:border-zinc-700">
                        <span>Net Total</span>
                        <span
                          className={cn(
                            (statement.grandTotal
                              ? Number(statement.grandTotal)
                              : 0) >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {formatCurrency(statement.grandTotal, 'USD', {
                            centsToDollars: false,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          {/* Search Results Summary */}
          {!isLoading && !isError && searchQuery.trim() && (
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="text-xs text-muted-foreground">
                {filteredStatements.length > 0
                  ? `Showing ${filteredStatements.length} of ${ownerStatements?.length ?? 0} statements`
                  : `No results for "${searchQuery}"`}
              </div>
              </div>
            )}
        </div>
      </div>

      {/* Right Content - Statement Details */}
      <div
        className={cn(
          'flex-1 overflow-hidden',
          !selectedStatementId && 'hidden md:block'
        )}
      >
        {selectedStatementId ? (
          <OwnerStatementContent
            statementId={selectedStatementId}
            onClose={() => handleSelectStatement(null)}
            onRefresh={() => void refetch()}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center max-w-md">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                Select a Statement
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Choose an owner statement from the list to view and edit its
                details, or create a new one to get started.
              </p>
              <Button
                variant="default"
                onClick={handleOpenImportModal}
                className="text-sm"
              >
                Create New Statement
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <MonthlyImportModal open={isModalOpen} onClose={handleCloseImportModal} />

      <ExportMonthlyStatements
        open={isExportSummaryDialogOpen}
        onOpenChange={setIsExportSummaryDialogOpen}
        initialMonth={selectedDate ?? null}
      />

      <ExportMonthlyIndividualStatements
        open={isExportAllIndividualDialogOpen}
        onOpenChange={setIsExportAllIndividualDialogOpen}
        initialMonth={selectedDate ?? null}
      />
    </div>
  )
}
