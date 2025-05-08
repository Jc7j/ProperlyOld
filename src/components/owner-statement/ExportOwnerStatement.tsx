'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { type CellHookData, type UserOptions } from 'jspdf-autotable'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'

type CellContent =
  | string
  | {
      content: string
      colSpan?: number
      rowSpan?: number
      styles?: UserOptions['styles']
    }

interface IncomeItem {
  checkIn: string | null | Date
  checkOut: string | null | Date
  days: number | null
  platform: string | null
  guest: string | null
  grossRevenue: number | null
  hostFee: number | null
  platformFee: number | null
  grossIncome: number | null
}

interface ExpenseItem {
  date: string | null | Date
  description: string | null
  vendor: string | null
  amount: number | null
}

interface AdjustmentItem {
  checkIn: string | null | Date
  checkOut: string | null | Date
  description: string | null
  amount: number | null
}

// Export the interface
export interface OwnerStatementData {
  propertyName: string
  statementMonth: string | Date
  incomes?: IncomeItem[]
  expenses?: ExpenseItem[]
  adjustments?: AdjustmentItem[]
  notes?: string | null
  grandTotal?: number | null
}

const getLastTableY = (doc: jsPDF): number => {
  return (doc as any).lastAutoTable?.finalY || 0
}

/**
 * Adds an owner statement's content to an existing jsPDF document.
 * @param doc - The jsPDF instance.
 * @param statementData - The data for the owner statement.
 * @param startY - The Y position to start drawing the content.
 * @returns The Y position after drawing the statement content.
 */
export function addOwnerStatementToPdf(
  doc: jsPDF,
  statementData: OwnerStatementData,
  startY: number
): number {
  const {
    propertyName,
    statementMonth,
    incomes = [],
    expenses = [],
    adjustments = [],
    notes,
  } = statementData

  const leftMargin = 15
  const rightMargin = 15
  const usableWidth = doc.internal.pageSize.width - leftMargin - rightMargin
  let currentY = startY

  // --- Header ---
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Owner Statement', leftMargin, currentY)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const statementDate = dayjs(statementMonth).isValid()
    ? dayjs(statementMonth).format('MMMM YYYY')
    : 'Invalid Date'
  doc.text(
    `${propertyName} - ${statementDate}`,
    doc.internal.pageSize.width - rightMargin,
    currentY,
    { align: 'right' }
  )
  currentY += 8
  doc.setDrawColor(200)
  doc.line(
    leftMargin,
    currentY,
    doc.internal.pageSize.width - rightMargin,
    currentY
  )
  currentY += 8

  // --- Calculate Totals ---
  const totalIncome = incomes.reduce(
    (sum, i) => sum + (Number(i.grossIncome) || 0),
    0
  )
  const totalGrossRevenue = incomes.reduce(
    (sum, i) => sum + (Number(i.grossRevenue) || 0),
    0
  )
  const totalHostFee = incomes.reduce(
    (sum, i) => sum + (Number(i.hostFee) || 0),
    0
  )
  const totalPlatformFee = incomes.reduce(
    (sum, i) => sum + (Number(i.platformFee) || 0),
    0
  )
  const totalDays = incomes.reduce((sum, i) => sum + (Number(i.days) || 0), 0)
  const totalExpenses = expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  )
  const totalAdjustments = adjustments.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  )
  const grandTotal =
    statementData.grandTotal ?? totalIncome - totalExpenses + totalAdjustments

  // --- Income Section ---
  if (incomes.length > 0) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Income', leftMargin, currentY)
    currentY += 5

    const incomeHead = [
      [
        'Check In',
        'Check Out',
        'Days',
        'Platform',
        'Guest',
        'Gross Rev',
        'Host Fee',
        'Platform Fee',
        'Gross Inc',
      ],
    ]
    const incomeBody: CellContent[][] = incomes.map((item) => [
      item.checkIn ? dayjs(item.checkIn).format('YYYY-MM-DD') : '-',
      item.checkOut ? dayjs(item.checkOut).format('YYYY-MM-DD') : '-',
      item.days?.toString() ?? '0',
      item.platform ?? '-',
      item.guest ?? '-',
      formatCurrency(item.grossRevenue, 'USD', { centsToDollars: false }),
      formatCurrency(item.hostFee, 'USD', { centsToDollars: false }),
      formatCurrency(item.platformFee, 'USD', { centsToDollars: false }),
      formatCurrency(item.grossIncome, 'USD', { centsToDollars: false }),
    ])

    incomeBody.push([
      {
        content: 'Total',
        colSpan: 2,
        styles: { fontStyle: 'bold', halign: 'left' },
      },
      {
        content: totalDays.toString(),
        styles: { fontStyle: 'bold', halign: 'right' },
      },
      { content: '', styles: {} }, // Empty cells for Platform and Guest
      { content: '', styles: {} },
      {
        content: formatCurrency(totalGrossRevenue, 'USD', {
          centsToDollars: false,
        }),
        styles: { fontStyle: 'bold', halign: 'right' },
      },
      {
        content: formatCurrency(totalHostFee, 'USD', { centsToDollars: false }),
        styles: { fontStyle: 'bold', halign: 'right' },
      },
      {
        content: formatCurrency(totalPlatformFee, 'USD', {
          centsToDollars: false,
        }),
        styles: { fontStyle: 'bold', halign: 'right' },
      },
      {
        content: formatCurrency(totalIncome, 'USD', { centsToDollars: false }),
        styles: { fontStyle: 'bold', halign: 'right' },
      },
    ])

    autoTable(doc, {
      startY: currentY,
      head: incomeHead,
      body: incomeBody,
      theme: 'grid',
      margin: { left: leftMargin, right: rightMargin },
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [50, 50, 50],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'left' }, // Check In
        1: { cellWidth: 20, halign: 'left' }, // Check Out
        2: { cellWidth: 10, halign: 'right' }, // Days
        3: { cellWidth: 15, halign: 'left' }, // Platform
        4: { cellWidth: 25, halign: 'left' }, // Guest
        5: { cellWidth: 20, halign: 'right' }, // Gross Rev
        6: { cellWidth: 20, halign: 'right' }, // Host Fee
        7: { cellWidth: 20, halign: 'right' }, // Platform Fee
        8: { cellWidth: 20, halign: 'right' }, // Gross Inc
      },
      didParseCell: function (data: CellHookData) {
        // Custom styling for the total row cells
        if (
          data.row.index === incomeBody.length - 1 &&
          typeof data.cell.raw !== 'string' // Check if it's an object (merged cell or styled cell)
        ) {
          data.cell.styles = data.cell.styles ?? {}
          data.cell.styles.fillColor = [245, 245, 245]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    currentY = getLastTableY(doc) + 8
  }

  // --- Expenses Section ---
  if (expenses.length > 0) {
    // Check for page break before adding section
    if (currentY + 20 > doc.internal.pageSize.height - 30) {
      doc.addPage()
      currentY = 20 // Reset Y for new page
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Expenses', leftMargin, currentY)
    currentY += 5

    const expenseHead = [['Date', 'Description', 'Vendor', 'Amount']]
    const expenseBody: CellContent[][] = expenses.map((item) => [
      item.date ? dayjs(item.date).format('YYYY-MM-DD') : '-',
      item.description ?? '-',
      item.vendor ?? '-',
      formatCurrency(item.amount, 'USD', { centsToDollars: false }),
    ])

    // Add total row
    expenseBody.push([
      {
        content: 'Total Expenses',
        colSpan: 3,
        styles: { fontStyle: 'bold', halign: 'left' },
      },
      {
        content: formatCurrency(totalExpenses, 'USD', {
          centsToDollars: false,
        }),
        styles: { fontStyle: 'bold', halign: 'right' },
      },
    ])

    autoTable(doc, {
      startY: currentY,
      head: expenseHead,
      body: expenseBody,
      theme: 'grid',
      margin: { left: leftMargin, right: rightMargin },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [50, 50, 50],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 30, halign: 'left' }, // Date
        1: { cellWidth: 'auto', halign: 'left' }, // Description
        2: { cellWidth: 40, halign: 'left' }, // Vendor
        3: { cellWidth: 30, halign: 'right' }, // Amount
      },
      didParseCell: function (data: CellHookData) {
        if (data.row.index === expenseBody.length - 1) {
          data.cell.styles = data.cell.styles ?? {}
          data.cell.styles.fillColor = [245, 245, 245]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    currentY = getLastTableY(doc) + 8
  }

  // --- Adjustments Section ---
  if (adjustments.length > 0) {
    // Check for page break
    if (currentY + 20 > doc.internal.pageSize.height - 30) {
      doc.addPage()
      currentY = 20
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Adjustments', leftMargin, currentY)
    currentY += 5

    const adjHead = [['Check In', 'Check Out', 'Description', 'Amount']]
    const adjBody: CellContent[][] = adjustments.map((item) => [
      item.checkIn ? dayjs(item.checkIn).format('YYYY-MM-DD') : '-',
      item.checkOut ? dayjs(item.checkOut).format('YYYY-MM-DD') : '-',
      item.description ?? '-',
      formatCurrency(item.amount, 'USD', { centsToDollars: false }),
    ])

    // Add total row
    adjBody.push([
      {
        content: 'Total Adjustments',
        colSpan: 3,
        styles: { fontStyle: 'bold', halign: 'left' },
      },
      {
        content: formatCurrency(totalAdjustments, 'USD', {
          centsToDollars: false,
        }),
        styles: { fontStyle: 'bold', halign: 'right' },
      },
    ])

    autoTable(doc, {
      startY: currentY,
      head: adjHead,
      body: adjBody,
      theme: 'grid',
      margin: { left: leftMargin, right: rightMargin },
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [50, 50, 50],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 30, halign: 'left' }, // Check In
        1: { cellWidth: 30, halign: 'left' }, // Check Out
        2: { cellWidth: 'auto', halign: 'left' }, // Description
        3: { cellWidth: 30, halign: 'right' }, // Amount
      },
      didParseCell: function (data: CellHookData) {
        if (data.row.index === adjBody.length - 1) {
          data.cell.styles = data.cell.styles ?? {}
          data.cell.styles.fillColor = [245, 245, 245]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    currentY = getLastTableY(doc) + 8
  }

  // --- Notes Section (Full Width) ---
  if (notes && notes.trim() !== '') {
    // Check if notes exist and are not just whitespace
    if (currentY + 20 > doc.internal.pageSize.height - 30) {
      // Check for page break
      doc.addPage()
      currentY = 20
    }
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes', leftMargin, currentY)
    currentY += 4
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const notesLines = doc.splitTextToSize(notes, usableWidth) // Use notes directly
    // Calculate dynamic height based on lines and line height
    const notesTextHeight =
      notesLines.length * (doc.getLineHeight() / doc.internal.scaleFactor)
    const notesPadding = 6 // Top/bottom padding inside the box
    const notesBoxHeight = notesTextHeight + notesPadding * 2
    doc.setDrawColor(220)
    doc.rect(leftMargin, currentY, usableWidth, notesBoxHeight)
    doc.text(notesLines, leftMargin + 3, currentY + notesPadding)
    currentY += notesBoxHeight + 8 // Add space after notes box
  }

  // --- Summary Section (Full Width) ---
  if (currentY + 40 > doc.internal.pageSize.height - 30) {
    // Check for page break
    doc.addPage()
    currentY = 20
  }
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', leftMargin, currentY) // Align title left
  currentY += 6

  // Summary Table (using autoTable for better alignment)
  const summaryData: CellContent[][] = [
    [
      'Total Income:',
      formatCurrency(totalIncome, 'USD', { centsToDollars: false }),
    ],
    [
      'Total Expenses:',
      `(${formatCurrency(totalExpenses, 'USD', { centsToDollars: false })})`,
    ],
    [
      'Total Adjustments:',
      formatCurrency(totalAdjustments, 'USD', { centsToDollars: false }),
    ],
  ]

  autoTable(doc, {
    startY: currentY,
    body: summaryData,
    theme: 'plain',
    tableWidth: usableWidth, // Use full usable width
    margin: { left: leftMargin }, // Use standard left margin
    styles: { fontSize: 9, cellPadding: 0.5 },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 'wrap' }, // Let label wrap if needed
      1: { halign: 'right' },
    },
  })
  currentY = getLastTableY(doc) + 2 // Update Y position after table

  // Separator line (full width)
  doc.setDrawColor(150)
  doc.line(leftMargin, currentY, leftMargin + usableWidth, currentY)
  currentY += 4

  // Grand Total (full width)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Grand Total / Disbursement:', leftMargin, currentY, {
    align: 'left',
  }) // Align label left
  doc.text(
    formatCurrency(grandTotal, 'USD', { centsToDollars: false }),
    leftMargin + usableWidth, // Align value right using full width
    currentY,
    { align: 'right' }
  )
  currentY += 8 // Add some space after grand total

  return currentY // Return the final Y position
}

/**
 * Exports a single owner statement to a PDF file.
 */
export function exportSingleOwnerStatement(statementData: OwnerStatementData) {
  const doc = new jsPDF()
  addOwnerStatementToPdf(doc, statementData, 20) // Start at Y=20

  // Add page numbers
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

  const filename = `OwnerStatement-${statementData.propertyName}-${dayjs(
    statementData.statementMonth
  ).format('YYYY-MM')}.pdf`
  doc.save(filename)
}
