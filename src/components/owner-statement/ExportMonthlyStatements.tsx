'use client'

import jsPDF from 'jspdf'
import autoTable, { type CellHookData, type UserOptions } from 'jspdf-autotable'
import { useEffect, useState } from 'react'
import DatePicker from '~/components/DatePicker'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '~/components/ui'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

type CellContent =
  | string
  | {
      content: string
      colSpan?: number
      rowSpan?: number
      styles?: UserOptions['styles']
    }

const safeToNumber = (value: any): number => {
  if (value === null || value === undefined) return 0
  const strValue =
    typeof value === 'object' &&
    value !== null &&
    typeof value.toString === 'function'
      ? value.toString()
      : String(value)
  const num = Number(strValue)
  return isNaN(num) ? 0 : num
}

interface ExportMonthlyStatementsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMonth: Date | null
}

export default function ExportMonthlyStatements({
  open,
  onOpenChange,
  initialMonth,
}: ExportMonthlyStatementsProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialMonth)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    // If the dialog is opened and initialMonth is different from selectedDate, update selectedDate
    // This handles cases where the initialMonth might change while the dialog is closed.
    if (
      open &&
      initialMonth &&
      (!selectedDate ||
        dayjs(initialMonth).format('YYYY-MM') !==
          dayjs(selectedDate).format('YYYY-MM'))
    ) {
      setSelectedDate(initialMonth)
    }
    // If the dialog is closed, we might want to reset selectedDate or leave it.
    // For now, let's reset it if it's not aligned with a potential new initialMonth when reopened.
  }, [open, initialMonth, selectedDate])

  const { data: statements, isLoading: isLoadingStatements } =
    api.ownerStatement.getMany.useQuery(
      {
        month: selectedDate ? dayjs(selectedDate).format('YYYY-MM') : undefined,
      },
      {
        enabled: !!selectedDate && open, // Only fetch when dialog is open and date selected
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      }
    )

  async function handleExport() {
    if (!selectedDate || !statements?.length) {
      ErrorToast('No statements found for the selected month.')
      return
    }

    setIsExporting(true)
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    const margin = 15
    let currentY = margin

    try {
      const monthStr = dayjs(selectedDate).format('MMMM YYYY')
      const filename = `MonthlyOwnerStatements-${dayjs(selectedDate).format('YYYY-MM')}.pdf`

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(
        `Owner Statements Summary - ${monthStr}`,
        pageWidth / 2,
        currentY,
        { align: 'center' }
      )
      currentY += 10

      const head = [
        ['Property', 'Income', 'Expenses', 'Adjustments', 'Grand Total'],
      ]

      const body: CellContent[][] = statements.map((stmt) => {
        if (!stmt) return ['Error', 'Error', 'Error', 'Error', 'Error'] // Handle potential null/undefined in array

        // Use safeToNumber for currency values from the summary query
        const income = formatCurrency(safeToNumber(stmt.totalIncome), 'USD', {
          centsToDollars: false,
        })
        const expenses = formatCurrency(
          safeToNumber(stmt.totalExpenses),
          'USD',
          { centsToDollars: false }
        )
        const adjustments = formatCurrency(
          safeToNumber(stmt.totalAdjustments),
          'USD',
          { centsToDollars: false }
        )
        const total = formatCurrency(safeToNumber(stmt.grandTotal), 'USD', {
          centsToDollars: false,
        })

        return [
          stmt.property?.name ?? 'N/A', // Access property name
          income,
          expenses,
          adjustments,
          total,
        ]
      })

      const totalIncomeAll = statements.reduce(
        (sum, s) => sum + safeToNumber(s?.totalIncome),
        0
      )
      const totalExpensesAll = statements.reduce(
        (sum, s) => sum + safeToNumber(s?.totalExpenses),
        0
      )
      const totalAdjustmentsAll = statements.reduce(
        (sum, s) => sum + safeToNumber(s?.totalAdjustments),
        0
      )
      const grandTotalAll = statements.reduce(
        (sum, s) => sum + safeToNumber(s?.grandTotal),
        0
      )

      body.push([
        {
          content: 'Month Total',
          colSpan: 1,
          styles: { fontStyle: 'bold', halign: 'left' },
        },
        {
          content: formatCurrency(totalIncomeAll, 'USD', {
            centsToDollars: false,
          }),
          styles: { fontStyle: 'bold', halign: 'right' },
        },
        {
          content: formatCurrency(totalExpensesAll, 'USD', {
            centsToDollars: false,
          }),
          styles: { fontStyle: 'bold', halign: 'right' },
        },
        {
          content: formatCurrency(totalAdjustmentsAll, 'USD', {
            centsToDollars: false,
          }),
          styles: { fontStyle: 'bold', halign: 'right' },
        },
        {
          content: formatCurrency(grandTotalAll, 'USD', {
            centsToDollars: false,
          }),
          styles: { fontStyle: 'bold', halign: 'right' },
        },
      ])

      autoTable(doc, {
        startY: currentY,
        head: head,
        body: body, // Pass the correctly typed body
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: {
          fillColor: [230, 230, 230],
          textColor: [50, 50, 50],
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 'auto' }, // Property
          1: { halign: 'right' }, // Income
          2: { halign: 'right' }, // Expenses
          3: { halign: 'right' }, // Adjustments
          4: { halign: 'right' }, // Grand Total
        },
        didParseCell: function (data: CellHookData) {
          // Add type for hook data
          // Style the total row
          if (
            data.row.index === body.length - 1 &&
            typeof data.cell.raw === 'object'
          ) {
            // Check if raw is object for styled cells
            data.cell.styles = data.cell.styles ?? {}
            data.cell.styles.fillColor = [245, 245, 245]
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })
      currentY = (doc as any).lastAutoTable.finalY + 10 // Update currentY using helper

      // --- Add Page Numbers ---
      // Ensure statements is an array before looping
      if (!Array.isArray(statements)) {
        ErrorToast('Received invalid statement data.')
        setIsExporting(false)
        return
      }

      // Add page numbers to the combined document
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10, // Position near the bottom
          { align: 'center' }
        )
      }

      // --- Save PDF ---
      doc.save(filename)
      SuccessToast(
        `Exported summary for ${statements.length} statement(s) for ${monthStr}`
      )
    } catch (error) {
      console.error('PDF Export Error:', error)
      ErrorToast('Failed to export statement summary. Please check console.')
    } finally {
      setIsExporting(false)
      onOpenChange(false) // Close dialog via prop
      // setSelectedDate(null) // Reset date after export - consider if this should be linked to initialMonth
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Export Monthly Statement Summary</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select a month to export a summary PDF of all statements from that
              period.
            </p>

            <DatePicker
              selected={selectedDate ?? undefined}
              onChange={(date: Date | null) => setSelectedDate(date)}
              showMonthYearPicker
              placeholderText="Select a month"
            />

            {selectedDate && isLoadingStatements && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading statement summary...
              </p>
            )}

            {selectedDate && !isLoadingStatements && statements && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {statements.length} statement
                {statements.length !== 1 ? 's' : ''} found for{' '}
                {dayjs(selectedDate).format('MMMM YYYY')}.
              </p>
            )}
            {selectedDate && !isLoadingStatements && !statements?.length && (
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                No statements found for{' '}
                {dayjs(selectedDate).format('MMMM YYYY')}.
              </p>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={
              !selectedDate ||
              isLoadingStatements ||
              !statements?.length ||
              isExporting
            }
            onClick={handleExport}
          >
            {isExporting
              ? 'Exporting...'
              : `Export Summary (${statements?.length ?? 0})`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
