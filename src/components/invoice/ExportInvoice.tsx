'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import dayjs from '~/lib/utils/day'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'

interface ExportInvoiceProps {
  invoice: InvoiceWithUser
  propertyName: string
  propertyLocation: string | null
  ownerInfo: {
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
  }
}

export function exportInvoiceToPdf({
  invoice,
  propertyName,
  propertyLocation,
  ownerInfo,
}: ExportInvoiceProps) {
  const doc = new jsPDF()
  const leftMargin = 20

  // Set default font
  doc.setFont('helvetica')

  // Header - Owner Info
  doc.setFontSize(10)
  doc.text(ownerInfo.name ?? 'Owner Name Not Available', 20, 15)
  doc.text(ownerInfo.address ?? 'Address Not Available', 20, 20)
  doc.text(ownerInfo.email ?? 'Email Not Available', 20, 25)
  doc.text(ownerInfo.phone ?? 'Phone Not Available', 20, 30)

  // Date
  doc.text(
    `Date: ${dayjs(invoice.invoiceDate).format('MM/DD/YYYY')}`,
    doc.internal.pageSize.width - 20,
    15,
    { align: 'right' }
  )

  // Horizontal line
  doc.line(20, 35, doc.internal.pageSize.width - 20, 35)

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Invoice for ${propertyName}`, doc.internal.pageSize.width / 2, 45, {
    align: 'center',
  })

  // Property address
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    propertyLocation ?? 'Address Not Available',
    doc.internal.pageSize.width / 2,
    52,
    {
      align: 'center',
    }
  )

  // --- New Section: BILL TO and Charges & Reimbursements ---
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL TO:', leftMargin, 62)
  doc.setFont('helvetica', 'normal')
  doc.text('Avana LLC', leftMargin, 68) // Adjust company name as needed

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Charges and Reimbursements', leftMargin, 78)
  // -------------------------------------------------------------

  // --- Build table data with sections ---
  // Split items into categories based on customItemName
  const managementFee = invoice.items.find(
    (item) => item.customItemName === 'Property Management Fee'
  )

  const maintenanceItems = invoice.items.filter(
    (item) =>
      item.customItemName && item.customItemName !== 'Property Management Fee'
  )

  const supplyItems = invoice.items.filter((item) => !item.customItemName)

  const tableData: any[] = []

  // Management Fee Section
  if (managementFee) {
    tableData.push([
      'Property Management Fee',
      managementFee.quantity.toString(),
      `$${((managementFee.price * managementFee.quantity) / 100).toFixed(2)}`,
    ])
  }

  // Maintenance Items Section
  if (maintenanceItems.length > 0) {
    tableData.push([
      {
        content: 'Maintenance Items',
        colSpan: 3,
        styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
      },
    ])
    maintenanceItems.forEach((item) => {
      const description = `${item.customItemName}${
        item.date ? '\n' + dayjs(item.date).format('MMM D, YYYY') : ''
      }`
      tableData.push([
        description,
        item.quantity.toString(),
        `$${((item.price * item.quantity) / 100).toFixed(2)}`,
      ])
    })
  }

  // Supply Items Section
  if (supplyItems.length > 0) {
    tableData.push([
      {
        content: 'Supply Items (Taxed at 8.375%)',
        colSpan: 3,
        styles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
      },
    ])
    supplyItems.forEach((item) => {
      const description = item.managementGroupItem?.name ?? 'Unknown Item'
      tableData.push([
        description,
        item.quantity.toString(),
        `$${((item.price * item.quantity) / 100).toFixed(2)}`,
      ])
    })
  }
  // -------------------------------------------------------------

  // AutoTable with updated startY to account for the new header sections
  autoTable(doc, {
    startY: 82,
    margin: { left: leftMargin },
    head: [['Description', 'Quantity', 'Amount']],
    body: tableData,
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY || 120

  // --- Financial Details Calculation ---
  // Calculate management fee amount and tax for supply items
  const mgmtFeeAmount = managementFee
    ? (managementFee.price * managementFee.quantity) / 100
    : 0
  const taxableItemsTotal = supplyItems.reduce(
    (total, item) => total + (item.price * item.quantity) / 100,
    0
  )
  const taxAmount = Number((taxableItemsTotal * 0.08375).toFixed(2))

  doc.setFontSize(10)
  doc.text(`Supplies Total:`, doc.internal.pageSize.width - 80, finalY + 10, {
    align: 'left',
  })
  const suppliesTotal =
    (invoice.financialDetails?.subtotal ?? 0) / 100 - mgmtFeeAmount
  doc.text(
    `$${suppliesTotal.toFixed(2)}`,
    doc.internal.pageSize.width - 20,
    finalY + 10,
    { align: 'right' }
  )

  doc.text(`Taxes (8.375%):`, doc.internal.pageSize.width - 80, finalY + 20, {
    align: 'left',
  })
  doc.text(
    `$${taxAmount.toFixed(2)}`,
    doc.internal.pageSize.width - 20,
    finalY + 20,
    { align: 'right' }
  )

  doc.line(20, finalY + 25, doc.internal.pageSize.width - 20, finalY + 25)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Due:`, doc.internal.pageSize.width - 80, finalY + 32, {
    align: 'left',
  })
  doc.text(
    `$${((invoice.financialDetails?.totalAmount ?? 0) / 100).toFixed(2)}`,
    doc.internal.pageSize.width - 20,
    finalY + 32,
    { align: 'right' }
  )
  // -------------------------------------------------------------

  doc.save(`invoice_${dayjs(invoice.invoiceDate).format('YYYY-MM')}.pdf`)
}
