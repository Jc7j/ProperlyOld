'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import dayjs from '~/lib/utils/day'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
import {
  type PropertyLocationInfo,
  type PropertyOwner,
} from '~/server/api/types'

interface ExportInvoiceProps {
  invoice: InvoiceWithUser
  propertyName: string
  propertyLocation: PropertyLocationInfo
  ownerInfo: PropertyOwner
}

export async function exportInvoiceToPdf({
  invoice,
  propertyName,
  propertyLocation,
  ownerInfo,
}: ExportInvoiceProps) {
  const doc = new jsPDF()
  const leftMargin = 20
  let yPos = 20

  // Set default font
  doc.setFont('helvetica')

  // Header - Owner Info
  doc.setFontSize(10)
  doc.text(ownerInfo.name ?? 'Owner Name Not Available', 20, 15)
  doc.text(ownerInfo.email ?? 'Email Not Available', 20, 20)
  doc.text(ownerInfo.phone ?? 'Phone Not Available', 20, 25)

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
    propertyLocation.address ?? 'Address Not Available',
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
  const managementFee = invoice.items?.find(
    (item) => item.customItemName === 'Property Management Fee'
  )

  const maintenanceItems = invoice.items?.filter(
    (item) =>
      item.customItemName && item.customItemName !== 'Property Management Fee'
  )

  const supplyItems = invoice.items?.filter((item) => !item.customItemName)

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
  if (maintenanceItems && maintenanceItems.length > 0) {
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
  if (supplyItems && supplyItems.length > 0) {
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

  const maintenanceItemsTotal = maintenanceItems
    ? maintenanceItems.reduce(
        (total, item) => total + (item.price * item.quantity) / 100,
        0
      )
    : 0

  const taxableItemsTotal = supplyItems
    ? supplyItems.reduce(
        (total, item) => total + (item.price * item.quantity) / 100,
        0
      )
    : 0
  const taxAmount = Number((taxableItemsTotal * 0.08375).toFixed(2))

  let currentY = finalY + 10

  // Supplies total
  doc.setFontSize(10)
  doc.text(`Supplies Total:`, doc.internal.pageSize.width - 80, currentY, {
    align: 'left',
  })
  doc.text(
    `$${taxableItemsTotal.toFixed(2)}`,
    doc.internal.pageSize.width - 20,
    currentY,
    { align: 'right' }
  )

  // Maintenance total
  currentY += 10
  doc.text(`Maintenance Total:`, doc.internal.pageSize.width - 80, currentY, {
    align: 'left',
  })
  doc.text(
    `$${maintenanceItemsTotal.toFixed(2)}`,
    doc.internal.pageSize.width - 20,
    currentY,
    { align: 'right' }
  )

  // Tax
  currentY += 10
  doc.text(`Taxes (8.375%):`, doc.internal.pageSize.width - 80, currentY, {
    align: 'left',
  })
  doc.text(
    `$${taxAmount.toFixed(2)}`,
    doc.internal.pageSize.width - 20,
    currentY,
    { align: 'right' }
  )

  // Line and total
  doc.line(20, currentY + 5, doc.internal.pageSize.width - 20, currentY + 5)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total Due:`, doc.internal.pageSize.width - 80, currentY + 12, {
    align: 'left',
  })
  doc.text(
    `$${((invoice.financialDetails?.totalAmount ?? 0) / 100).toFixed(2)}`,
    doc.internal.pageSize.width - 20,
    currentY + 12,
    { align: 'right' }
  )
  // -------------------------------------------------------------

  // Add images section if there are images
  if (invoice.images && invoice.images.length > 0) {
    // Start after the financial details with some padding
    yPos = currentY + 20

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Attached Images', 20, yPos)

    // Create a grid of images with smaller dimensions
    const imagesPerRow = 2
    const imageWidth = 60
    const imageHeight = 45
    const xPadding = 20
    const yPadding = 15
    const borderWidth = 0.2 // Subtle border width

    for (let i = 0; i < invoice.images.length; i++) {
      const image = invoice.images[i]

      // Calculate position in grid
      const row = Math.floor(i / imagesPerRow)
      const col = i % imagesPerRow
      const xPos = xPadding + col * (imageWidth + 20)
      const currentYPos = yPos + 15 + row * (imageHeight + yPadding)

      // Check if we need a new page
      if (currentYPos + imageHeight + 10 > doc.internal.pageSize.height - 20) {
        doc.addPage()
        yPos = 20
        const newCurrentYPos = yPos + 15 + (row % 3) * (imageHeight + yPadding)

        try {
          const response = await fetch(image?.url ?? '')
          const blob = await response.blob()
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })

          // Draw border
          doc.setDrawColor(200, 200, 200) // Light gray border
          doc.setLineWidth(borderWidth)
          doc.rect(
            xPos - 1,
            newCurrentYPos - 1,
            imageWidth + 2,
            imageHeight + 2
          )

          // Add image
          doc.addImage(
            base64,
            'JPEG',
            xPos,
            newCurrentYPos,
            imageWidth,
            imageHeight
          )
        } catch (error) {
          console.error('Failed to add image to PDF:', error)
        }
      } else {
        try {
          const response = await fetch(image?.url ?? '')
          const blob = await response.blob()
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })

          // Draw border
          doc.setDrawColor(200, 200, 200) // Light gray border
          doc.setLineWidth(borderWidth)
          doc.rect(xPos - 1, currentYPos - 1, imageWidth + 2, imageHeight + 2)

          // Add image
          doc.addImage(
            base64,
            'JPEG',
            xPos,
            currentYPos,
            imageWidth,
            imageHeight
          )
        } catch (error) {
          console.error('Failed to add image to PDF:', error)
        }
      }

      // Update yPos to account for all images
      if (i === invoice.images.length - 1) {
        yPos = currentYPos + imageHeight + 20
      }
    }
  }

  // Add page numbers if content spans multiple pages
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

  // Save the PDF
  doc.save(`Invoice-${propertyName}-${invoice.id}.pdf`)
}
