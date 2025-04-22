'use client'

import jsPDF from 'jspdf'
import { useState } from 'react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
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

  const { data: invoices, isLoading: isLoadingInvoices } =
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

  async function handleExport() {
    if (!selectedDate || !invoices || invoices.length === 0) {
      ErrorToast('No invoices found for the selected month.')
      return
    }
    if (!Array.isArray(invoices)) {
      ErrorToast('Received invalid invoice data.')
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
          console.warn(`Skipping null/undefined invoice at index ${i}`)
          continue
        }

        if (!invoice?.property?.name) {
          console.warn('Skipping invoice due to missing data:', invoice)
          continue
        }

        if (i > 0) {
          doc.addPage()
          currentY = 20
        }

        const params: AddInvoiceToPdfParams = {
          invoice: invoice,
          propertyName: invoice.property.name,
          propertyLocation: invoice.property.locationInfo as any,
          ownerInfo: {
            name: (invoice.property.owner as any)?.name ?? '',
            email: (invoice.property.owner as any)?.email ?? '',
            phone: (invoice.property.owner as any)?.phone ?? '',
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
        Export Monthly Invoices (PDF)
      </Button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>Export Monthly Invoices</DialogTitle>

        <DialogBody>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select a month to export all invoices from that period into a
              single PDF file.
            </p>

            <ReactDatePicker
              selected={selectedDate}
              onChange={(date: Date | null) => setSelectedDate(date)}
              dateFormat="MMMM yyyy"
              showMonthYearPicker
              placeholderText="Select a month"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              wrapperClassName="w-full"
              popperPlacement="bottom-start"
            />

            {selectedDate && isLoadingInvoices && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading invoices...
              </p>
            )}
            {selectedDate && !isLoadingInvoices && invoices && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}{' '}
                found for {dayjs(selectedDate).format('MMMM YYYY')}
              </p>
            )}
            {selectedDate &&
              !isLoadingInvoices &&
              (!invoices || invoices.length === 0) && (
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
                !invoices?.length ||
                isExporting
              }
              onClick={handleExport}
            >
              {isExporting
                ? 'Exporting...'
                : `Export ${invoices?.length ?? 0} Invoice${
                    (invoices?.length ?? 0) !== 1 ? 's' : ''
                  }`}
            </Button>
          </DialogActions>
        </DialogBody>
      </Dialog>
    </>
  )
}
