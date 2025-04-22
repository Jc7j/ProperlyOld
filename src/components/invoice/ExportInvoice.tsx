'use client'

import jsPDF from 'jspdf'
import autoTable, { type CellHookData, type UserOptions } from 'jspdf-autotable'
import dayjs from '~/lib/utils/day'
import { type InvoiceWithUser } from '~/server/api/routers/invoice'
import {
  type PropertyLocationInfo,
  type PropertyOwner,
} from '~/server/api/types'

// Define the cell content type for jspdf-autotable (similar to owner statement)
type CellContent =
  | string
  | {
      content: string
      colSpan?: number
      rowSpan?: number
      styles?: UserOptions['styles'] // Use UserOptions['styles'] for consistency
    }

// Export this interface
export interface AddInvoiceToPdfParams {
  invoice: InvoiceWithUser
  propertyName: string
  propertyLocation: PropertyLocationInfo | null
  ownerInfo: PropertyOwner
}

// Helper to safely get table Y position
const getLastTableY = (doc: jsPDF): number => {
  return (doc as any).lastAutoTable?.finalY || 0
}

/**
 * Adds a single invoice's content to an existing jsPDF document.
 * @param doc - The jsPDF instance.
 * @param params - The data for the invoice.
 * @param startY - The Y position to start drawing the content.
 * @returns The Y position after drawing the invoice content.
 */
export async function addInvoiceToPdf(
  doc: jsPDF,
  params: AddInvoiceToPdfParams,
  startY: number
): Promise<number> {
  const { invoice, propertyName, propertyLocation, ownerInfo } = params
  const leftMargin = 20
  const rightMargin = 20
  const pageHeight = doc.internal.pageSize.height
  const bottomMargin = 20 // For page break checks
  let currentY = startY

  // Ensure we have enough space for the header, add page if needed
  if (currentY + 60 > pageHeight - bottomMargin) {
    // Estimate header height
    doc.addPage()
    currentY = 20 // Reset Y on new page
  }

  // Set default font
  doc.setFont('helvetica')

  // Header - Owner Info
  doc.setFontSize(10)
  doc.text(ownerInfo.name ?? 'Owner Name Not Available', leftMargin, currentY)
  currentY += 5
  doc.text(ownerInfo.email ?? 'Email Not Available', leftMargin, currentY)
  currentY += 5
  doc.text(ownerInfo.phone ?? 'Phone Not Available', leftMargin, currentY)

  // Date (reset Y for right alignment)
  const headerRightY = startY
  doc.text(
    `Date: ${dayjs(invoice.invoiceDate).format('MM/DD/YYYY')}`,
    doc.internal.pageSize.width - rightMargin,
    headerRightY,
    { align: 'right' }
  )

  // Ensure currentY is below the potentially longer right-side header info
  currentY = Math.max(currentY, headerRightY) + 10

  // Horizontal line
  doc.setDrawColor(200)
  doc.line(
    leftMargin,
    currentY,
    doc.internal.pageSize.width - rightMargin,
    currentY
  )
  currentY += 10

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `Invoice for ${propertyName}`,
    doc.internal.pageSize.width / 2,
    currentY,
    {
      align: 'center',
    }
  )
  currentY += 7

  // Property address
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    propertyLocation?.address ?? 'Address Not Available',
    doc.internal.pageSize.width / 2,
    currentY,
    {
      align: 'center',
    }
  )
  currentY += 10

  // --- New Section: BILL TO and Charges & Reimbursements ---
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('BILL TO:', leftMargin, currentY)
  currentY += 6
  doc.setFont('helvetica', 'normal')
  doc.text('Avana LLC', leftMargin, currentY) // Adjust company name as needed
  currentY += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Charges and Reimbursements', leftMargin, currentY)
  currentY += 4 // Space before table
  // -------------------------------------------------------------

  // --- Build table data with sections ---
  const managementFee = invoice.items?.find(
    (item) => item.customItemName === 'Supply Drop Fee'
  )

  const maintenanceItems = invoice.items?.filter(
    (item) => item.customItemName && item.customItemName !== 'Supply Drop Fee'
  )

  const supplyItems = invoice.items?.filter((item) => !item.customItemName)

  const tableData: CellContent[][] = [] // Use CellContent type

  // Management Fee Section
  if (managementFee) {
    tableData.push([
      'Supply Drop Fee',
      managementFee.quantity?.toString() ?? '1', // Default quantity if null
      `$${((managementFee.price * (managementFee.quantity ?? 1)) / 100).toFixed(2)}`,
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
      '', // Placeholder for Quantity column alignment
      '', // Placeholder for Amount column alignment
    ])
    maintenanceItems.forEach((item) => {
      const description = `${item.customItemName ?? 'Maintenance'}${
        item.date ? `\n${dayjs(item.date).format('MMM D, YYYY')}` : ''
      }`
      tableData.push([
        description,
        item.quantity?.toString() ?? '1',
        `$${((item.price * (item.quantity ?? 1)) / 100).toFixed(2)}`,
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
      '', // Placeholder
      '', // Placeholder
    ])
    supplyItems.forEach((item) => {
      const description = item.managementGroupItem?.name ?? 'Unknown Item'
      tableData.push([
        description,
        item.quantity?.toString() ?? '1',
        `$${((item.price * (item.quantity ?? 1)) / 100).toFixed(2)}`,
      ])
    })
  }
  // -------------------------------------------------------------

  // AutoTable with updated startY
  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: rightMargin },
    head: [['Description', 'Quantity', 'Amount']],
    body: tableData, // Use the correctly typed body
    theme: 'grid', // Use grid theme for clarity
    styles: {
      fontSize: 10,
      cellPadding: 2,
      overflow: 'linebreak', // Handle long descriptions
    },
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 25, halign: 'center' }, // Smaller width for Quantity
      2: { cellWidth: 35, halign: 'right' }, // Smaller width for Amount
    },
    didParseCell: function (data: CellHookData) {
      // Style header rows (bold, specific fill color)
      if (
        data.cell.raw &&
        typeof data.cell.raw === 'object' &&
        'colSpan' in data.cell.raw &&
        data.cell.raw.colSpan === 3
      ) {
        data.cell.styles = data.cell.styles ?? {}
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [240, 240, 240]
        data.cell.styles.halign = 'left' // Align header text left
      }
    },
  })

  currentY = getLastTableY(doc) // Update currentY after table

  // --- Financial Details Calculation ---
  const maintenanceItemsTotal = maintenanceItems
    ? maintenanceItems.reduce(
        (total, item) => total + (item.price * (item.quantity ?? 1)) / 100,
        0
      )
    : 0

  const taxableItemsTotal = supplyItems
    ? supplyItems.reduce(
        (total, item) => total + (item.price * (item.quantity ?? 1)) / 100,
        0
      )
    : 0
  const taxRate = 0.08375 // Consider making this configurable if needed
  const taxAmount = Number((taxableItemsTotal * taxRate).toFixed(2))

  const supplyDropFeeAmount = managementFee
    ? (managementFee.price * (managementFee.quantity ?? 1)) / 100
    : 0

  // Recalculate total amount based on items (more reliable than stored value)
  const calculatedTotal =
    taxableItemsTotal + maintenanceItemsTotal + supplyDropFeeAmount + taxAmount

  // --- Draw Financial Summary ---
  const summaryStartY = currentY + 8 // Start summary below table
  const summaryItems: { label: string; value: string }[] = []

  if (taxableItemsTotal > 0) {
    summaryItems.push({
      label: 'Supplies Total:',
      value: `$${taxableItemsTotal.toFixed(2)}`,
    })
  }
  if (maintenanceItemsTotal > 0) {
    summaryItems.push({
      label: 'Maintenance Total:',
      value: `$${maintenanceItemsTotal.toFixed(2)}`,
    })
  }
  if (supplyDropFeeAmount > 0) {
    summaryItems.push({
      label: 'Supply Drop Fee:',
      value: `$${supplyDropFeeAmount.toFixed(2)}`,
    })
  }
  if (taxAmount > 0) {
    summaryItems.push({
      label: `Taxes (${(taxRate * 100).toFixed(3)}%):`,
      value: `$${taxAmount.toFixed(2)}`,
    })
  }

  // Check for page break before drawing summary
  const summaryHeightEstimate = summaryItems.length * 6 + 15 // Estimate height
  if (summaryStartY + summaryHeightEstimate > pageHeight - bottomMargin) {
    doc.addPage()
    currentY = 20 // Reset Y
  } else {
    currentY = summaryStartY // Use summaryStartY if no page break
  }

  const summaryTableData = summaryItems.map((item) => [item.label, item.value])

  autoTable(doc, {
    startY: currentY,
    body: summaryTableData,
    theme: 'plain',
    tableWidth: 80, // Fixed width for summary table
    margin: { left: doc.internal.pageSize.width - rightMargin - 80 }, // Align right
    styles: { fontSize: 10, cellPadding: 1 },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'normal' },
      1: { halign: 'right', fontStyle: 'normal' },
    },
  })

  currentY = getLastTableY(doc) + 2 // Get Y after summary table

  // Line before total
  doc.setDrawColor(150)
  doc.line(
    doc.internal.pageSize.width - rightMargin - 80,
    currentY,
    doc.internal.pageSize.width - rightMargin,
    currentY
  )
  currentY += 5

  // Total Due
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `Total Due:`,
    doc.internal.pageSize.width - rightMargin - 80,
    currentY,
    {
      align: 'left',
    }
  )
  doc.text(
    `$${calculatedTotal.toFixed(2)}`, // Use calculated total
    doc.internal.pageSize.width - rightMargin,
    currentY,
    { align: 'right' }
  )
  currentY += 8 // Space after total

  // -------------------------------------------------------------

  // Add images section if there are images
  if (invoice.images && invoice.images.length > 0) {
    // Check for page break before starting images section
    if (currentY + 60 > pageHeight - bottomMargin) {
      // Estimate height for title + one row
      doc.addPage()
      currentY = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Attached Images', leftMargin, currentY)
    currentY += 10 // Space after title

    const imagesPerRow = 2
    const imageWidth = 60
    const imageHeight = 45
    const xPadding = leftMargin // Use leftMargin directly
    const yPadding = 10 // Reduce vertical padding
    const xGap =
      (doc.internal.pageSize.width - 2 * xPadding - imagesPerRow * imageWidth) /
      (imagesPerRow - 1) // Calculate gap between images
    const borderWidth = 0.2 // Subtle border width

    for (let i = 0; i < invoice.images.length; i++) {
      const image = invoice.images[i]
      if (!image?.url) continue // Skip if no URL

      // Calculate position in grid
      const row = Math.floor(i / imagesPerRow)
      const col = i % imagesPerRow
      const xPos = xPadding + col * (imageWidth + xGap)
      let imageYPos = currentY + row * (imageHeight + yPadding)

      // Check if we need a new page FOR THE IMAGE ITSELF
      if (imageYPos + imageHeight > pageHeight - bottomMargin) {
        doc.addPage()
        currentY = 20 // Reset Y for the new page's content
        imageYPos = currentY // Image starts at the top of the new page
        // If starting new page, re-draw section title? Optional, maybe not needed.
        // doc.setFontSize(12)
        // doc.setFont('helvetica', 'bold')
        // doc.text('Attached Images (Continued)', leftMargin, currentY)
        // currentY += 10;
        // imageYPos = currentY; // Adjust if title is re-added
      }

      try {
        const response = await fetch(image.url) // Use validated URL
        // Check if response is ok and content type is image-like
        if (
          !response.ok ||
          !response.headers.get('content-type')?.startsWith('image')
        ) {
          console.warn(
            `Skipping image (fetch failed or not an image): ${image.url}`
          )
          doc.setFont('helvetica', 'italic')
          doc.setTextColor(150)
          doc.text(
            'Image unavailable',
            xPos + imageWidth / 2,
            imageYPos + imageHeight / 2,
            { align: 'center', baseline: 'middle' }
          )
          doc.setTextColor(0) // Reset color
          continue // Skip to next image
        }
        const blob = await response.blob()
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject // Add error handling
          reader.readAsDataURL(blob)
        })

        // Draw border
        doc.setDrawColor(200, 200, 200) // Light gray border
        doc.setLineWidth(borderWidth)
        doc.rect(xPos - 1, imageYPos - 1, imageWidth + 2, imageHeight + 2)

        // Add image
        doc.addImage(
          base64,
          'JPEG', // Assume JPEG, adjust if needed or inspect blob type
          xPos,
          imageYPos,
          imageWidth,
          imageHeight
        )

        // Update currentY to be below the latest image drawn in this loop iteration
        // This ensures subsequent content starts below the image grid
        currentY = Math.max(currentY, imageYPos + imageHeight + yPadding)
      } catch (error) {
        console.error('Failed to fetch or add image to PDF:', image.url, error)
        // Optionally draw a placeholder if fetch/add fails
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(150)
        doc.text(
          'Image load error',
          xPos + imageWidth / 2,
          imageYPos + imageHeight / 2,
          { align: 'center', baseline: 'middle' }
        )
        doc.setTextColor(0) // Reset color
        // Still update currentY to keep layout consistent
        currentY = Math.max(currentY, imageYPos + imageHeight + yPadding)
      }
    }
    currentY += 5 // Add a small padding after the last image row
  }

  // Return the final Y position
  return currentY
}

/**
 * Exports a single invoice to a PDF file.
 * (This function now acts as a simple wrapper around addInvoiceToPdf)
 */
export async function exportInvoiceToPdf(params: AddInvoiceToPdfParams) {
  const doc = new jsPDF()
  await addInvoiceToPdf(doc, params, 20) // Start at Y=20

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

  // Save the PDF
  doc.save(`Invoice-${params.propertyName}-${params.invoice.id}.pdf`)
}
