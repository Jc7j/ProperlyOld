'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import 'react-datepicker/dist/react-datepicker.css'
import { Button } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'

// Type for property summaries
interface PropertySummary {
  propertyId: string
  propertyName: string
  suppliesTotal: number
  maintenanceTotal: number
  osTotalIncome: number
  osTotalExpenses: number
  osTotalAdjustments: number
  osTotalGrossRevenue: number
  osTotalHostFee: number
  osTotalPlatformFee: number
  osTotalDays: number
}

// Type for invoice item
interface InvoiceItem {
  price: number
  quantity?: number | null
  customItemName?: string | null
  managementGroupItemsId?: string | null
}

// Type for invoice
interface Invoice {
  propertyId: string | null
  items?: InvoiceItem[]
}

// Type for owner statement with incomes
interface OwnerStatementWithIncomes extends Record<string, any> {
  incomes?: Array<{
    grossRevenue?: number | null
    hostFee?: number | null
    platformFee?: number | null
    days?: number | null
  }>
  totalIncome?: number | null
  totalExpenses?: number | null
  totalAdjustments?: number | null
}

// Interface for component props
interface MonthlyOverviewProps {
  date: Date | undefined
  monthQuery: string | undefined
  isLoading: boolean
  properties: any[]
  invoices: { invoices: Invoice[]; totalCount: number }
  ownerStatements: any[]
}

// Helper to format currency with dash for zero values
const formatCurrencyOrDash = (
  value: number,
  currency = 'USD',
  options: any = {}
) => {
  if (value === 0) return '-'
  return formatCurrency(value, currency, options)
}

// Helper to format number with dash for zero values
const formatNumberOrDash = (value: number) => {
  if (value === 0) return '-'
  return value.toString()
}

export default function MonthlyOverview({
  date,
  monthQuery,
  isLoading,
  properties,
  invoices,
  ownerStatements,
}: MonthlyOverviewProps) {
  const [summarizedData, setSummarizedData] = useState<PropertySummary[]>([])

  // Group expenses by vendor for display
  const groupedExpensesByVendor = useMemo(() => {
    const vendorGroups: Record<
      string,
      { vendor: string; totalAmount: number; count: number }
    > = {}

    // This would be implemented if we had expense data per property
    // For now, it's a placeholder that will be filled with real data
    // when we have expense details

    return Object.values(vendorGroups)
  }, [])

  // Calculate summary data
  useEffect(() => {
    if (!properties || !invoices || !ownerStatements || !monthQuery) {
      return
    }

    // Map property data with summaries
    const summaries: PropertySummary[] = properties.map((property) => {
      // Get invoices for this property
      const propertyInvoices =
        invoices.invoices.filter(
          (invoice) => invoice.propertyId === property.id
        ) ?? []

      // Get owner statement for this property
      const ownerStatement = ownerStatements.find(
        (statement) => statement.propertyId === property.id
      ) as OwnerStatementWithIncomes | undefined

      // Calculate invoice totals
      let suppliesTotal = 0
      let maintenanceTotal = 0
      const taxRate = 0.08375 // 8.375% tax rate

      propertyInvoices.forEach((invoice: Invoice) => {
        ;(invoice.items ?? []).forEach((item: InvoiceItem) => {
          const itemTotalCents = item.price * (item.quantity ?? 1)
          const itemTotalDollars = itemTotalCents / 100

          if (!item.customItemName && item.managementGroupItemsId) {
            // Supply Item (taxable)
            const itemWithTax = itemTotalDollars * (1 + taxRate)
            suppliesTotal += itemWithTax
          } else if (item.customItemName === 'Supply Drop Fee') {
            // Supply Drop Fee
            maintenanceTotal += itemTotalDollars
          } else {
            // Regular maintenance item
            maintenanceTotal += itemTotalDollars
          }
        })
      })

      // Calculate owner statement totals
      let osTotalIncome = 0
      let osTotalExpenses = 0
      let osTotalAdjustments = 0
      let osTotalGrossRevenue = 0
      let osTotalHostFee = 0
      let osTotalPlatformFee = 0
      let osTotalDays = 0

      if (ownerStatement) {
        osTotalIncome = Number(ownerStatement.totalIncome ?? 0)
        osTotalExpenses = Number(ownerStatement.totalExpenses ?? 0)
        osTotalAdjustments = Number(ownerStatement.totalAdjustments ?? 0)

        // Calculate totals from incomes
        ;(ownerStatement.incomes ?? []).forEach((income) => {
          osTotalGrossRevenue += Number(income.grossRevenue ?? 0)
          osTotalHostFee += Number(income.hostFee ?? 0)
          osTotalPlatformFee += Number(income.platformFee ?? 0)
          osTotalDays += Number(income.days ?? 0)
        })
      }

      return {
        propertyId: property.id,
        propertyName: property.name,
        suppliesTotal,
        maintenanceTotal,
        osTotalIncome,
        osTotalExpenses,
        osTotalAdjustments,
        osTotalGrossRevenue,
        osTotalHostFee,
        osTotalPlatformFee,
        osTotalDays,
      }
    })

    // Sort properties alphabetically by name
    const sortedSummaries = [...summaries].sort((a, b) =>
      a.propertyName.localeCompare(b.propertyName)
    )

    setSummarizedData(sortedSummaries)
  }, [properties, invoices, ownerStatements, monthQuery])

  // Calculate column totals
  const totals = useMemo(() => {
    const calculatedTotals = summarizedData.reduce(
      (acc, item) => {
        return {
          suppliesTotal: acc.suppliesTotal + item.suppliesTotal,
          maintenanceTotal: acc.maintenanceTotal + item.maintenanceTotal,
          osTotalIncome: acc.osTotalIncome + item.osTotalIncome,
          osTotalExpenses: acc.osTotalExpenses + item.osTotalExpenses,
          osTotalAdjustments: acc.osTotalAdjustments + item.osTotalAdjustments,
          osTotalGrossRevenue:
            acc.osTotalGrossRevenue + item.osTotalGrossRevenue,
          osTotalHostFee: acc.osTotalHostFee + item.osTotalHostFee,
          osTotalPlatformFee: acc.osTotalPlatformFee + item.osTotalPlatformFee,
          osTotalDays: acc.osTotalDays + item.osTotalDays,
        }
      },
      {
        suppliesTotal: 0,
        maintenanceTotal: 0,
        osTotalIncome: 0,
        osTotalExpenses: 0,
        osTotalAdjustments: 0,
        osTotalGrossRevenue: 0,
        osTotalHostFee: 0,
        osTotalPlatformFee: 0,
        osTotalDays: 0,
      }
    )

    return calculatedTotals
  }, [summarizedData])

  // Generate and download PDF
  const handlePrintPdf = () => {
    if (!date || summarizedData.length === 0) return

    const doc = new jsPDF({ orientation: 'landscape' })
    const formattedMonth = dayjs(date).format('MMMM YYYY')

    // Define table headers
    const headers = [
      'Property',
      'Supplies',
      'Maintenance',
      'Income',
      'Gross Revenue',
      'Host Fee',
      'Platform Fee',
      'Days',
      'Expenses',
      'Adjustments',
    ]

    // Create table data rows
    const rows = summarizedData.map((item) => [
      item.propertyName,
      item.suppliesTotal === 0
        ? '-'
        : formatCurrency(item.suppliesTotal, 'USD', { centsToDollars: false }),
      item.maintenanceTotal === 0
        ? '-'
        : formatCurrency(item.maintenanceTotal, 'USD', {
            centsToDollars: false,
          }),
      item.osTotalIncome === 0
        ? '-'
        : formatCurrency(item.osTotalIncome, 'USD', { centsToDollars: false }),
      item.osTotalGrossRevenue === 0
        ? '-'
        : formatCurrency(item.osTotalGrossRevenue, 'USD', {
            centsToDollars: false,
          }),
      item.osTotalHostFee === 0
        ? '-'
        : formatCurrency(item.osTotalHostFee, 'USD', { centsToDollars: false }),
      item.osTotalPlatformFee === 0
        ? '-'
        : formatCurrency(item.osTotalPlatformFee, 'USD', {
            centsToDollars: false,
          }),
      item.osTotalDays === 0 ? '-' : item.osTotalDays.toString(),
      item.osTotalExpenses === 0
        ? '-'
        : formatCurrency(item.osTotalExpenses, 'USD', {
            centsToDollars: false,
          }),
      item.osTotalAdjustments === 0
        ? '-'
        : formatCurrency(item.osTotalAdjustments, 'USD', {
            centsToDollars: false,
          }),
    ])

    // Add totals footer row
    const footerRow = [
      'TOTALS',
      totals.suppliesTotal === 0
        ? '-'
        : formatCurrency(totals.suppliesTotal, 'USD', {
            centsToDollars: false,
          }),
      totals.maintenanceTotal === 0
        ? '-'
        : formatCurrency(totals.maintenanceTotal, 'USD', {
            centsToDollars: false,
          }),
      totals.osTotalIncome === 0
        ? '-'
        : formatCurrency(totals.osTotalIncome, 'USD', {
            centsToDollars: false,
          }),
      totals.osTotalGrossRevenue === 0
        ? '-'
        : formatCurrency(totals.osTotalGrossRevenue, 'USD', {
            centsToDollars: false,
          }),
      totals.osTotalHostFee === 0
        ? '-'
        : formatCurrency(totals.osTotalHostFee, 'USD', {
            centsToDollars: false,
          }),
      totals.osTotalPlatformFee === 0
        ? '-'
        : formatCurrency(totals.osTotalPlatformFee, 'USD', {
            centsToDollars: false,
          }),
      totals.osTotalDays === 0 ? '-' : totals.osTotalDays.toString(),
      totals.osTotalExpenses === 0
        ? '-'
        : formatCurrency(totals.osTotalExpenses, 'USD', {
            centsToDollars: false,
          }),
      totals.osTotalAdjustments === 0
        ? '-'
        : formatCurrency(totals.osTotalAdjustments, 'USD', {
            centsToDollars: false,
          }),
    ]

    // Add title
    doc.setFontSize(16)
    doc.text(`Monthly Property Statement - ${formattedMonth}`, 14, 15)

    // Generate table
    autoTable(doc, {
      head: [headers],
      body: rows,
      foot: [footerRow],
      startY: 25,
      headStyles: {
        fillColor: [22, 163, 74],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [229, 231, 235],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
      },
    })

    // Add page numbers
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }

    doc.save(`Monthly_Statement_${dayjs(date).format('YYYY-MM')}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="outline"
          onClick={handlePrintPdf}
          disabled={summarizedData.length === 0 || isLoading}
          size="sm"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Table */}
          <div className="overflow-x-auto">
            <div className="max-h-[600px] overflow-y-auto border rounded-md">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 z-10">
                  <tr>
                    <th className="border px-3 py-2 text-left">Property</th>
                    <th className="border px-3 py-2 text-right">Supplies</th>
                    <th className="border px-3 py-2 text-right">Maintenance</th>
                    <th className="border px-3 py-2 text-right">Income</th>
                    <th className="border px-3 py-2 text-right">
                      Gross Revenue
                    </th>
                    <th className="border px-3 py-2 text-right">Host Fee</th>
                    <th className="border px-3 py-2 text-right">
                      Platform Fee
                    </th>
                    <th className="border px-3 py-2 text-right">Days</th>
                    <th className="border px-3 py-2 text-right">Expenses</th>
                    <th className="border px-3 py-2 text-right">Adjustments</th>
                  </tr>
                </thead>
                <tbody>
                  {summarizedData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="border px-3 py-4 text-center text-gray-500"
                      >
                        {date
                          ? `No data found for ${dayjs(date).format('MMMM YYYY')}`
                          : 'Please select a month to view data'}
                      </td>
                    </tr>
                  ) : (
                    summarizedData.slice(0, 30).map((item) => (
                      <tr
                        key={item.propertyId}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="border px-3 py-2">
                          {item.propertyName}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatCurrencyOrDash(item.suppliesTotal, 'USD', {
                            centsToDollars: false,
                          })}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatCurrencyOrDash(item.maintenanceTotal, 'USD', {
                            centsToDollars: false,
                          })}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatCurrencyOrDash(item.osTotalIncome, 'USD', {
                            centsToDollars: false,
                          })}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatCurrencyOrDash(
                            item.osTotalGrossRevenue,
                            'USD',
                            {
                              centsToDollars: false,
                            }
                          )}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatCurrencyOrDash(item.osTotalHostFee, 'USD', {
                            centsToDollars: false,
                          })}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatCurrencyOrDash(
                            item.osTotalPlatformFee,
                            'USD',
                            {
                              centsToDollars: false,
                            }
                          )}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatNumberOrDash(item.osTotalDays)}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatCurrencyOrDash(item.osTotalExpenses, 'USD', {
                            centsToDollars: false,
                          })}
                        </td>
                        <td className="border px-3 py-2 text-right">
                          {formatCurrencyOrDash(
                            item.osTotalAdjustments,
                            'USD',
                            {
                              centsToDollars: false,
                            }
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {summarizedData.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-zinc-100 dark:bg-zinc-800 z-10">
                    <tr className="font-medium">
                      <td className="border px-3 py-2">TOTALS</td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(totals.suppliesTotal, 'USD', {
                          centsToDollars: false,
                        })}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(totals.maintenanceTotal, 'USD', {
                          centsToDollars: false,
                        })}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(totals.osTotalIncome, 'USD', {
                          centsToDollars: false,
                        })}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(
                          totals.osTotalGrossRevenue,
                          'USD',
                          {
                            centsToDollars: false,
                          }
                        )}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(totals.osTotalHostFee, 'USD', {
                          centsToDollars: false,
                        })}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(
                          totals.osTotalPlatformFee,
                          'USD',
                          {
                            centsToDollars: false,
                          }
                        )}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatNumberOrDash(totals.osTotalDays)}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(totals.osTotalExpenses, 'USD', {
                          centsToDollars: false,
                        })}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(
                          totals.osTotalAdjustments,
                          'USD',
                          {
                            centsToDollars: false,
                          }
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Expenses by Vendor Section */}
          {groupedExpensesByVendor.length > 0 && (
            <div className="mt-8">
              <h3 className="text-base font-medium mb-3">Expenses by Vendor</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-800">
                    <th className="border px-3 py-2 text-left">Vendor</th>
                    <th className="border px-3 py-2 text-right">Items</th>
                    <th className="border px-3 py-2 text-right">
                      Total Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedExpensesByVendor.map((group, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="border px-3 py-2">{group.vendor}</td>
                      <td className="border px-3 py-2 text-right">
                        {group.count}
                      </td>
                      <td className="border px-3 py-2 text-right">
                        {formatCurrencyOrDash(group.totalAmount, 'USD', {
                          centsToDollars: false,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
