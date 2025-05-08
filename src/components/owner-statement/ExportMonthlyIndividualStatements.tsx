'use client'

import jsPDF from 'jspdf'
import { useState } from 'react'
import DatePicker from '~/components/DatePicker'
import {
  type OwnerStatementData as DetailedOwnerStatementData,
  addOwnerStatementToPdf,
} from '~/components/owner-statement/ExportOwnerStatement'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '~/components/ui'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

export default function ExportMonthlyIndividualStatements() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // IMPORTANT ASSUMPTION:
  // We are assuming a tRPC query 'api.ownerStatement.getManyWithDetails' exists and
  // returns an array of ApiFetchedDetailedStatement.
  // If it doesn't, this part needs to be adjusted to use the correct query
  // or the backend needs to be updated.
  const { data: statementsQueryResult, isLoading: isLoadingStatements } =
    api.ownerStatement.getManyWithDetails.useQuery(
      {
        month: selectedDate ? dayjs(selectedDate).format('YYYY-MM') : undefined,
      },
      {
        enabled: !!selectedDate && isOpen,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      }
    )

  const detailedStatements = statementsQueryResult?.statements // Assuming the query result has a 'statements' field

  async function handleExport() {
    if (
      !selectedDate ||
      !detailedStatements ||
      detailedStatements.length === 0
    ) {
      ErrorToast('No detailed statements found for the selected month.')
      return
    }

    setIsExporting(true)
    const doc = new jsPDF()
    let currentY = 20 // Initial Y position for the first statement

    try {
      for (let i = 0; i < detailedStatements.length; i++) {
        const statement = detailedStatements[i]

        if (!statement) {
          console.warn(`Skipping invalid statement data at index ${i}`)
          continue
        }

        if (i > 0) {
          doc.addPage()
          currentY = 20 // Reset Y for new page
        }

        // Map API data to the structure expected by addOwnerStatementToPdf
        const statementDataForPdf: DetailedOwnerStatementData = {
          propertyName: statement.property?.name ?? 'N/A',
          statementMonth: statement.statementMonth,
          incomes: statement.incomes,
          expenses: statement.expenses,
          adjustments: statement.adjustments,
          notes: statement.notes,
          grandTotal: statement.grandTotal,
        }

        // addOwnerStatementToPdf is synchronous and mutates the doc
        addOwnerStatementToPdf(doc, statementDataForPdf, currentY)
      }

      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        )
      }

      const monthStr = dayjs(selectedDate).format('YYYY-MM')
      doc.save(`AllOwnerStatements-${monthStr}.pdf`)
      SuccessToast(
        `Exported ${detailedStatements.length} statement(s) for ${dayjs(selectedDate).format('MMMM YYYY')}`
      )
    } catch (error) {
      console.error('Failed to export monthly individual statements:', error)
      ErrorToast('An error occurred during PDF export. Check console.')
    } finally {
      setIsExporting(false)
      setIsOpen(false)
      setSelectedDate(null)
    }
  }

  return (
    <>
      <Button variant="default" onClick={() => setIsOpen(true)}>
        Export All Statements
      </Button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>Export All Individual Statements</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select a month to export all individual owner statements from that
              period into a single PDF file. Each statement will be on a new
              page.
            </p>

            <DatePicker
              selected={selectedDate ?? undefined}
              onChange={(date: Date | null) => setSelectedDate(date)}
              showMonthYearPicker
              placeholderText="Select a month"
            />

            {selectedDate && isLoadingStatements && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading statements for {dayjs(selectedDate).format('MMMM YYYY')}
                ...
              </p>
            )}
            {selectedDate && !isLoadingStatements && detailedStatements && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {detailedStatements.length} statement
                {detailedStatements.length !== 1 ? 's' : ''} found for{' '}
                {dayjs(selectedDate).format('MMMM YYYY')}.
              </p>
            )}
            {selectedDate &&
              !isLoadingStatements &&
              (!detailedStatements || detailedStatements.length === 0) && (
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  No detailed statements found for{' '}
                  {dayjs(selectedDate).format('MMMM YYYY')}.
                </p>
              )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={
              !selectedDate ||
              isLoadingStatements ||
              !detailedStatements?.length ||
              isExporting
            }
            onClick={handleExport}
          >
            {isExporting
              ? 'Exporting...'
              : `Export ${detailedStatements?.length ?? 0} Statement${
                  (detailedStatements?.length ?? 0) !== 1 ? 's' : ''
                }`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
