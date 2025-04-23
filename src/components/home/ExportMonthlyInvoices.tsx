'use client'

import jsPDF from 'jspdf'
import { useState } from 'react'
import DatePicker from '~/components/DatePicker'
import {
  type AddInvoiceToPdfParams,
  addInvoiceToPdf,
} from '~/components/invoice/ExportInvoice'
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

export default function ExportMonthlyInvoices() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const { data: invoiceQueryResult, isLoading: isLoadingInvoices } =
    api.invoice.getMany.useQuery(
      {
        limit: 150,
        month: selectedDate ? dayjs(selectedDate).format('YYYY-MM') : undefined,
      },
      {
        enabled: !!selectedDate && isOpen,
        staleTime: 5 * 60 * 1000,
      }
    )

  const invoices = invoiceQueryResult?.invoices

  async function handleExport() {
    if (!selectedDate || !invoices || invoices.length === 0) {
      ErrorToast('No invoices found for the selected month.')
      return
    }

    setIsExporting(true)
    const doc = new jsPDF()
    let currentY = 20
    const pageHeight = doc.internal.pageSize.height

    try {
      for (let i = 0; i < invoices.length; i++) {
        const invoice = invoices[i]

        if (!invoice) {
          console.warn(`Skipping invalid invoice data at index ${i}`)
          continue
        }

        const propertyName = invoice.property?.name
        const propertyLocation = invoice.property?.locationInfo
        const ownerInfo = invoice.property?.owner

        if (!propertyName || !propertyLocation) {
          console.warn(
            'Skipping invoice due to missing property data:',
            invoice.id
          )
          continue
        }

        if (i > 0) {
          doc.addPage()
          currentY = 20
        }

        const params: AddInvoiceToPdfParams = {
          invoice: invoice,
          propertyName: propertyName,
          propertyLocation: propertyLocation,
          ownerInfo: {
            name: ownerInfo?.name ?? '',
            email: ownerInfo?.email ?? '',
            phone: ownerInfo?.phone ?? '',
          },
        }

        currentY = await addInvoiceToPdf(doc, params, currentY)
      }

      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      }

      const monthStr = dayjs(selectedDate).format('YYYY-MM')
      doc.save(`MonthlyInvoices-${monthStr}.pdf`)
      SuccessToast(
        `Exported ${invoices.length} invoice(s) for ${dayjs(selectedDate).format('MMMM YYYY')}`
      )
    } catch (error) {
      console.error('Failed to export monthly invoices:', error)
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
        Export Invoices
      </Button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>Export Monthly Invoices</DialogTitle>

        <DialogBody>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select a month to export all invoices from that period into a
              single PDF file.
            </p>

            <DatePicker
              selected={selectedDate ?? undefined}
              onChange={(date: Date | null) => setSelectedDate(date)}
              showMonthYearPicker
              placeholderText="Select a month"
            />

            {selectedDate && isLoadingInvoices && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading invoices for {dayjs(selectedDate).format('MMMM YYYY')}
                ...
              </p>
            )}
            {selectedDate &&
              !isLoadingInvoices &&
              invoiceQueryResult?.invoices && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {invoiceQueryResult.invoices.length} invoice
                  {invoiceQueryResult.invoices.length !== 1 ? 's' : ''} found
                  for {dayjs(selectedDate).format('MMMM YYYY')}
                </p>
              )}
            {selectedDate &&
              !isLoadingInvoices &&
              (!invoiceQueryResult?.invoices ||
                invoiceQueryResult.invoices.length === 0) && (
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  No invoices found for{' '}
                  {dayjs(selectedDate).format('MMMM YYYY')}.
                </p>
              )}
          </div>

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
                isLoadingInvoices ||
                !invoiceQueryResult?.invoices?.length ||
                isExporting
              }
              onClick={handleExport}
            >
              {isExporting
                ? 'Exporting...'
                : `Export ${invoiceQueryResult?.invoices?.length ?? 0} Invoice${
                    (invoiceQueryResult?.invoices?.length ?? 0) !== 1 ? 's' : ''
                  }`}
            </Button>
          </DialogActions>
        </DialogBody>
      </Dialog>
    </>
  )
}
