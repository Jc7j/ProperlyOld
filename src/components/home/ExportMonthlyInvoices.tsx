'use client'

import { useState } from 'react'
import ReactDatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { exportInvoiceToPdf } from '~/components/invoice/ExportInvoice'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

export default function ExportMonthlyInvoices() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const { data: invoices } = api.invoice.getMany.useQuery(
    {
      limit: 100,
      month: selectedDate ? dayjs(selectedDate).format('YYYY-MM') : undefined,
    },
    {
      enabled: !!selectedDate,
    }
  )

  async function handleExport() {
    if (!selectedDate || !invoices?.length) return

    setIsExporting(true)
    try {
      // Export each invoice in sequence
      for (const invoice of invoices) {
        if (!invoice.property?.name) continue

        await exportInvoiceToPdf({
          invoice,
          propertyName: invoice.property.name,
          propertyLocation: invoice.property.locationInfo,
          ownerInfo: {
            name: invoice.property.owner?.name ?? '',
            email: invoice.property.owner?.email ?? '',
            phone: invoice.property.owner?.phone ?? '',
          },
        })
      }
    } finally {
      setIsExporting(false)
      setIsOpen(false)
      setSelectedDate(null)
    }
  }

  return (
    <>
      <Button color="primary" onClick={() => setIsOpen(true)}>
        Export Monthly Invoices
      </Button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>Export Monthly Invoices</DialogTitle>

        <DialogBody>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select a month to export all invoices from that period.
            </p>

            <ReactDatePicker
              selected={selectedDate}
              onChange={(date: Date | null) => setSelectedDate(date)}
              dateFormat="MMMM yyyy"
              showMonthYearPicker
              placeholderText="Select a month"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              wrapperClassName="w-full"
            />

            {selectedDate && invoices && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}{' '}
                found for {dayjs(selectedDate).format('MMMM YYYY')}
              </p>
            )}
          </div>

          <DialogActions>
            <Button type="button" outline onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              disabled={!selectedDate || !invoices?.length || isExporting}
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
