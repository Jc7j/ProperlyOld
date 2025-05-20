'use client'

import jsPDF from 'jspdf'
import { useEffect, useMemo, useState } from 'react'
import DatePicker from '~/components/DatePicker'
import {
  type OwnerStatementData as DetailedOwnerStatementData,
  addOwnerStatementToPdf,
} from '~/components/owner-statement/ExportOwnerStatement'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
  Label,
} from '~/components/ui'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import dayjs from '~/lib/utils/day'
import { api } from '~/trpc/react'

interface ExportMonthlyIndividualStatementsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMonth: Date | null
}

type PropertyForSelection = {
  id: string
  name: string
}

export default function ExportMonthlyIndividualStatements({
  open,
  onOpenChange,
  initialMonth,
}: ExportMonthlyIndividualStatementsProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialMonth)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([])
  const [availableProperties, setAvailableProperties] = useState<
    PropertyForSelection[]
  >([])

  useEffect(() => {
    if (
      open &&
      initialMonth &&
      (!selectedDate ||
        dayjs(initialMonth).format('YYYY-MM') !==
          dayjs(selectedDate).format('YYYY-MM'))
    ) {
      setSelectedDate(initialMonth)
      setSelectedPropertyIds([])
    }
    if (!open) {
      setSelectedPropertyIds([])
      setAvailableProperties([])
    }
  }, [open, initialMonth, selectedDate])

  const { data: statementsQueryResult, isLoading: isLoadingStatements } =
    api.ownerStatement.getManyWithDetails.useQuery(
      {
        month: selectedDate ? dayjs(selectedDate).format('YYYY-MM') : undefined,
      },
      {
        enabled: !!selectedDate && open,
        staleTime: 1 * 60 * 1000,
      }
    )

  const detailedStatements = statementsQueryResult?.statements

  useEffect(() => {
    if (open && detailedStatements) {
      const uniquePropertiesMap = new Map<string, PropertyForSelection>()
      detailedStatements.forEach((stmt) => {
        if (stmt.property && !uniquePropertiesMap.has(stmt.property.id)) {
          uniquePropertiesMap.set(stmt.property.id, {
            id: stmt.property.id,
            name: stmt.property.name ?? `Property ${stmt.property.id}`,
          })
        }
      })
      const sortedProperties = Array.from(uniquePropertiesMap.values()).sort(
        (a, b) => a.name.localeCompare(b.name)
      )
      setAvailableProperties(sortedProperties)
    } else if (!open) {
      setAvailableProperties([])
    }
  }, [detailedStatements, open])

  const handleTogglePropertySelection = (propertyId: string) => {
    setSelectedPropertyIds((prevSelected) =>
      prevSelected.includes(propertyId)
        ? prevSelected.filter((id) => id !== propertyId)
        : [...prevSelected, propertyId]
    )
  }

  const handleSelectAllProperties = (isChecked: boolean) => {
    if (isChecked) {
      setSelectedPropertyIds(availableProperties.map((p) => p.id))
    } else {
      setSelectedPropertyIds([])
    }
  }

  const statementsToExport = useMemo(() => {
    if (!detailedStatements || selectedPropertyIds.length === 0) return []
    return detailedStatements.filter(
      (stmt) => stmt.property && selectedPropertyIds.includes(stmt.property.id)
    )
  }, [detailedStatements, selectedPropertyIds])

  async function handleExport() {
    if (!selectedDate || statementsToExport.length === 0) {
      ErrorToast(
        selectedPropertyIds.length === 0
          ? 'Please select at least one property to export.'
          : 'No statements found for the selected properties and month.'
      )
      return
    }

    setIsExporting(true)
    const doc = new jsPDF()
    let currentY = 20

    try {
      for (let i = 0; i < statementsToExport.length; i++) {
        const statement = statementsToExport[i]

        if (!statement) {
          console.warn(`Skipping invalid statement data at index ${i}`)
          continue
        }

        if (i > 0) {
          doc.addPage()
          currentY = 20
        }

        const statementDataForPdf: DetailedOwnerStatementData = {
          propertyName: statement.property?.name ?? 'N/A',
          statementMonth: statement.statementMonth,
          incomes: statement.incomes,
          expenses: statement.expenses,
          adjustments: statement.adjustments,
          notes: statement.notes,
          grandTotal: statement.grandTotal,
        }
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
      doc.save(`SelectedOwnerStatements-${monthStr}.pdf`)
      SuccessToast(
        `Exported ${statementsToExport.length} statement(s) for ${dayjs(selectedDate).format('MMMM YYYY')}`
      )
    } catch (error) {
      console.error(
        'Failed to export selected monthly individual statements:',
        error
      )
      ErrorToast('An error occurred during PDF export. Check console.')
    } finally {
      setIsExporting(false)
      onOpenChange(false)
    }
  }

  const allSelected =
    availableProperties.length > 0 &&
    selectedPropertyIds.length === availableProperties.length

  return (
    <>
      <Dialog open={open} onClose={() => onOpenChange(false)}>
        <DialogTitle>Export Individual Statements by Property</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select a month, then choose the properties for which you want to
              export individual statements.
            </p>

            <DatePicker
              selected={selectedDate ?? undefined}
              onChange={(date: Date | null) => {
                setSelectedDate(date)
                setSelectedPropertyIds([])
              }}
              showMonthYearPicker
              placeholderText="Select a month"
            />

            {selectedDate && isLoadingStatements && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading statements for {dayjs(selectedDate).format('MMMM YYYY')}
                ...
              </p>
            )}

            {selectedDate &&
              !isLoadingStatements &&
              !detailedStatements?.length && (
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  No statements found for{' '}
                  {dayjs(selectedDate).format('MMMM YYYY')}.
                </p>
              )}

            {selectedDate &&
              !isLoadingStatements &&
              detailedStatements &&
              detailedStatements.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-md font-medium text-zinc-800 dark:text-zinc-200">
                    Select Properties to Export:
                  </h3>
                  {availableProperties.length > 0 ? (
                    <>
                      <div className="flex items-center space-x-2 py-2">
                        <Checkbox
                          id="select-all-properties"
                          checked={allSelected}
                          onCheckedChange={(checked) => {
                            handleSelectAllProperties(
                              checked === true || checked === 'indeterminate'
                            )
                          }}
                        />
                        <Label
                          htmlFor="select-all-properties"
                          className="font-medium"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'} (
                          {availableProperties.length} Properties)
                        </Label>
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1 rounded-md border p-2">
                        {availableProperties.map((prop) => (
                          <div
                            key={prop.id}
                            className="flex items-center space-x-2 p-1 hover:bg-accent rounded-md"
                          >
                            <Checkbox
                              id={`prop-${prop.id}`}
                              checked={selectedPropertyIds.includes(prop.id)}
                              onCheckedChange={() =>
                                handleTogglePropertySelection(prop.id)
                              }
                            />
                            <Label
                              htmlFor={`prop-${prop.id}`}
                              className="text-sm font-normal w-full cursor-pointer"
                            >
                              {prop.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No properties with statements found for the selected
                      month.
                    </p>
                  )}
                </div>
              )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={
              !selectedDate ||
              isLoadingStatements ||
              statementsToExport.length === 0 ||
              isExporting
            }
            onClick={handleExport}
          >
            {isExporting
              ? 'Exporting...'
              : `Export ${statementsToExport.length} Statement${statementsToExport.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
