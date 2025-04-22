import {
  type ColumnDef,
  type Row,
  type Table,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable } from '~/components/table/data-table'
import { Button, Card, Input } from '~/components/ui'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'

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
  id?: string
}

interface ExpenseItem {
  date: string | null | Date
  description: string | null
  vendor: string | null
  amount: number | null
  id?: string
}

interface AdjustmentItem {
  checkIn: string | null | Date
  checkOut: string | null | Date
  description: string | null
  amount: number | null
  id?: string
}

interface TableMeta {
  editing: { section: string; rowIdx: number; field: string } | null
  setEditing: React.Dispatch<
    React.SetStateAction<{
      section: string
      rowIdx: number
      field: string
    } | null>
  >
  onChange: (section: string, rowIdx: number, key: string, value: any) => void
  readOnly: boolean
  handleDelete: (section: string, index: number) => void
  section: 'incomes' | 'expenses' | 'adjustments'
}

function isValidDateInput(
  value: any
): value is string | number | Date | dayjs.Dayjs | null | undefined {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof Date ||
    dayjs.isDayjs(value) ||
    value === null ||
    value === undefined
  )
}

const createEditableCell = <TData extends { id?: string }>(
  type: 'text' | 'number' = 'text',
  alignRight = false
): ColumnDef<TData>['cell'] => {
  const CellComponent: React.FC<{
    getValue: () => any
    row: Row<TData>
    column: ColumnDef<TData, any>
    table: Table<TData>
  }> = ({ getValue, row, column, table }) => {
    const initialValue = getValue()
    const meta = (table.options as any).meta as TableMeta | undefined
    if (!meta) {
      console.error('Table meta is not defined!')
      return <span>Error: Missing table meta</span>
    }

    if (typeof column.id !== 'string') {
      console.error('Column ID is not a string:', column.id)
      return <span>Error: Invalid column ID</span>
    }

    const field: string = column.id

    const { editing, setEditing, onChange, readOnly, section } = meta
    const rowIdx = row.index

    const isEditing =
      !readOnly &&
      editing?.section === section &&
      editing?.rowIdx === rowIdx &&
      editing?.field === field

    const handleBlur = () => {
      setEditing(null)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        setEditing(null)
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v: string | number | null = e.target.value
      if (type === 'number') {
        v = v === '' ? null : Number(v)
      }
      onChange(section, rowIdx, field, v)
    }

    const handleEditStart = () => {
      if (!readOnly) {
        setEditing({ section, rowIdx, field })
      }
    }

    const handleKeyDownDiv = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!readOnly && e.key === 'Enter') {
        handleEditStart()
      }
    }

    if (isEditing) {
      return (
        <Input
          autoFocus
          type={type === 'number' ? 'number' : 'text'}
          value={
            typeof initialValue === 'object' && initialValue !== null
              ? ''
              : String(initialValue ?? '')
          }
          className={`h-auto w-full border border-primary/40 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/70 ${alignRight ? 'text-right' : ''}`}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      )
    }

    const displayValue = () => {
      const value = initialValue
      if (value === null || value === undefined) {
        return <span className="text-zinc-400 dark:text-zinc-600">—</span>
      }

      if (typeof value === 'object') {
        return <span className="text-red-500 text-xs">Invalid Data</span>
      }

      if (type === 'number') {
        return typeof value === 'number' ? (
          formatCurrency(value)
        ) : (
          <span className="text-red-500 text-xs">Invalid Number</span>
        )
      } else if (['checkIn', 'checkOut', 'date'].includes(field)) {
        if (!isValidDateInput(value)) {
          return <span className="text-red-500 text-xs">Invalid Date</span>
        }
        const formatted = dayjs(value).isValid()
          ? dayjs(value).format('YYYY-MM-DD')
          : String(value)
        return (
          formatted || (
            <span className="text-zinc-400 dark:text-zinc-600">—</span>
          )
        )
      } else {
        return value
      }
    }

    return (
      <div
        className={`min-h-[36px] px-2 py-1.5 text-xs ${alignRight ? 'text-right' : 'text-left'} ${!readOnly ? 'cursor-pointer rounded hover:bg-primary/5 dark:hover:bg-primary/10 focus-within:bg-primary/10 dark:focus-within:bg-primary/20 focus:outline-none focus-within:ring-1 focus-within:ring-primary/40' : 'text-zinc-700 dark:text-zinc-300'}`}
        tabIndex={readOnly ? -1 : 0}
        onClick={handleEditStart}
        onKeyDown={handleKeyDownDiv}
        role={!readOnly ? 'button' : undefined}
        aria-label={`Edit ${field}`}
      >
        {displayValue()}
      </div>
    )
  }

  CellComponent.displayName = `EditableCell_${type}${alignRight ? '_Right' : ''}`

  return CellComponent
}

export default function OwnerStatementReviewTable({
  statementDraft,
  onChange,
  readOnly = false,
}: {
  statementDraft: any
  onChange: (section: string, rowIdx: number, key: string, value: any) => void
  readOnly?: boolean
}) {
  const {
    propertyName,
    statementMonth: rawStatementMonth,
    incomes = [],
    expenses = [],
    adjustments = [],
    notes,
    grandTotal,
  } = statementDraft

  const totalIncome = incomes.reduce(
    (sum: number, i: any) => sum + (Number(i.grossIncome) || 0),
    0
  )
  const totalGrossRevenue = incomes.reduce(
    (sum: number, i: any) => sum + (Number(i.grossRevenue) || 0),
    0
  )
  const totalHostFee = incomes.reduce(
    (sum: number, i: any) => sum + (Number(i.hostFee) || 0),
    0
  )
  const totalPlatformFee = incomes.reduce(
    (sum: number, i: any) => sum + (Number(i.platformFee) || 0),
    0
  )
  const totalDays = incomes.reduce(
    (sum: number, i: any) => sum + (Number(i.days) || 0),
    0
  )
  const totalExpenses = expenses.reduce(
    (sum: number, e: any) => sum + (Number(e.amount) || 0),
    0
  )
  const totalAdjustments = adjustments.reduce(
    (sum: number, a: any) => sum + (Number(a.amount) || 0),
    0
  )
  const grandTotalDisbursement =
    grandTotal ?? totalIncome - totalExpenses + totalAdjustments

  const [editing, setEditing] = useState<{
    section: string
    rowIdx: number
    field: string
  } | null>(null)

  const handleDelete = (section: string, idx: number) => {
    onChange(section, idx, '__delete', undefined)
  }
  const handleAdd = (field: string, template: any) => {
    onChange(field, -1, '__add', template)
  }

  const tableMeta = useMemo(
    () => ({
      editing,
      setEditing,
      onChange,
      readOnly,
      handleDelete,
    }),
    [editing, onChange, readOnly]
  )

  const incomeColumns = useMemo<ColumnDef<IncomeItem>[]>(
    () => [
      {
        accessorKey: 'checkIn',
        header: 'Check In',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'checkOut',
        header: 'Check Out',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'days',
        header: 'Days',
        cell: createEditableCell('number'),
      },
      {
        accessorKey: 'platform',
        header: 'Platform',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'guest',
        header: 'Guest',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'grossRevenue',
        header: 'Gross Revenue',
        cell: createEditableCell('number', true),
      },
      {
        accessorKey: 'hostFee',
        header: 'Host Fee',
        cell: createEditableCell('number', true),
      },
      {
        accessorKey: 'platformFee',
        header: 'Platform Fee',
        cell: createEditableCell('number', true),
      },
      {
        accessorKey: 'grossIncome',
        header: 'Gross Income',
        cell: createEditableCell('number', true),
      },
      ...(!readOnly
        ? [
            {
              id: 'actions',
              header: () => <div className="w-[50px]"></div>,
              cell: ({
                row,
                table,
              }: {
                row: Row<IncomeItem>
                table: Table<IncomeItem>
              }) => (
                <div className="flex items-center justify-center w-[50px]">
                  <Button
                    variant="destructiveOutline"
                    size="sm"
                    className="p-1 h-auto"
                    onClick={() =>
                      (table.options.meta as TableMeta).handleDelete(
                        'incomes',
                        row.index
                      )
                    }
                    aria-label="Delete income row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [readOnly]
  )

  const expenseColumns = useMemo<ColumnDef<ExpenseItem>[]>(
    () => [
      { accessorKey: 'date', header: 'Date', cell: createEditableCell('text') },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'vendor',
        header: 'Vendor',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: createEditableCell('number', true),
      },
      ...(!readOnly
        ? [
            {
              id: 'actions',
              header: () => <div className="w-[50px]"></div>,
              cell: ({
                row,
                table,
              }: {
                row: Row<ExpenseItem>
                table: Table<ExpenseItem>
              }) => (
                <div className="flex items-center justify-center w-[50px]">
                  <Button
                    variant="destructiveOutline"
                    size="sm"
                    className="p-1 h-auto"
                    onClick={() =>
                      (table.options.meta as TableMeta).handleDelete(
                        'expenses',
                        row.index
                      )
                    }
                    aria-label="Delete expense row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [readOnly]
  )

  const adjustmentColumns = useMemo<ColumnDef<AdjustmentItem>[]>(
    () => [
      {
        accessorKey: 'checkIn',
        header: 'Check In',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'checkOut',
        header: 'Check Out',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: createEditableCell('text'),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: createEditableCell('number', true),
      },
      ...(!readOnly
        ? [
            {
              id: 'actions',
              header: () => <div className="w-[50px]"></div>,
              cell: ({
                row,
                table,
              }: {
                row: Row<AdjustmentItem>
                table: Table<AdjustmentItem>
              }) => (
                <div className="flex items-center justify-center w-[50px]">
                  <Button
                    variant="destructiveOutline"
                    size="sm"
                    className="p-1 h-auto"
                    onClick={() =>
                      (table.options.meta as TableMeta).handleDelete(
                        'adjustments',
                        row.index
                      )
                    }
                    aria-label="Delete adjustment row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [readOnly]
  )

  const incomeTable = useReactTable({
    data: incomes,
    columns: incomeColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: { ...tableMeta, section: 'incomes' } as TableMeta,
  })

  const expenseTable = useReactTable({
    data: expenses,
    columns: expenseColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: { ...tableMeta, section: 'expenses' } as TableMeta,
  })

  const adjustmentTable = useReactTable({
    data: adjustments,
    columns: adjustmentColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: { ...tableMeta, section: 'adjustments' } as TableMeta,
  })

  const isEditingNotes =
    !readOnly &&
    editing?.section === 'notes' &&
    editing?.rowIdx === 0 &&
    editing?.field === 'notes'

  const handleNotesEditStart = () => {
    if (!readOnly) {
      setEditing({ section: 'notes', rowIdx: 0, field: 'notes' })
    }
  }

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setEditing(null)
    }
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange('notes', 0, 'notes', e.target.value)
  }

  const handleNotesKeyDownDiv = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!readOnly && e.key === 'Enter') {
      handleNotesEditStart()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-3">
        <div className="text-base font-bold">Owner Statement</div>
        <div className="text-right">
          <div className="font-semibold text-sm">{propertyName}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {dayjs(rawStatementMonth).isValid()
              ? dayjs(rawStatementMonth).format('MMMM YYYY')
              : 'Invalid Date'}
          </div>
        </div>
      </div>

      <Card>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-sm font-semibold">Income:</div>
            {!readOnly && (
              <Button
                onClick={() =>
                  handleAdd('incomes', {
                    checkIn: '',
                    checkOut: '',
                    days: 0,
                    platform: '',
                    guest: '',
                    grossRevenue: 0,
                    hostFee: 0,
                    platformFee: 0,
                    grossIncome: 0,
                  })
                }
                size="sm"
                className="h-auto px-2 py-1"
              >
                <Plus className="w-4 h-4 mr-1" /> Income
              </Button>
            )}
          </div>
          <DataTable table={incomeTable} className="min-w-[800px] text-xs" />
          <div className="flex justify-between items-center mt-2 px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/50 border rounded-b-md">
            <div className="w-[calc(100%/9*3)]">Total</div>
            <div className="w-[calc(100%/9)] text-center">{totalDays}</div>
            <div className="w-[calc(100%/9)]"></div>
            <div className="w-[calc(100%/9)] text-right">
              {formatCurrency(totalGrossRevenue)}
            </div>
            <div className="w-[calc(100%/9)] text-right">
              {formatCurrency(totalHostFee)}
            </div>
            <div className="w-[calc(100%/9)] text-right">
              {formatCurrency(totalPlatformFee)}
            </div>
            <div className="w-[calc(100%/9)] text-right">
              {formatCurrency(totalIncome)}
            </div>
            {!readOnly && <div className="w-[50px]"></div>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-sm font-semibold">Expenses:</div>
            {!readOnly && (
              <Button
                onClick={() =>
                  handleAdd('expenses', {
                    date: '',
                    description: '',
                    vendor: '',
                    amount: 0,
                  })
                }
                size="sm"
                className="h-auto px-2 py-1"
              >
                <Plus className="w-4 h-4 mr-1" /> Expense
              </Button>
            )}
          </div>
          <DataTable table={expenseTable} className="min-w-[600px] text-xs " />
          <div className="flex justify-between items-center mt-2 px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/50 border  rounded-b-md">
            <div className="flex-grow">Total</div>
            <div className="w-1/4 text-right">
              {formatCurrency(totalExpenses)}
            </div>
            {!readOnly && <div className="w-[50px]"></div>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-sm font-semibold">Adjustments:</div>
            {!readOnly && (
              <Button
                onClick={() =>
                  handleAdd('adjustments', {
                    checkIn: '',
                    checkOut: '',
                    description: '',
                    amount: 0,
                  })
                }
                size="sm"
                className="h-auto px-2 py-1"
              >
                <Plus className="w-4 h-4 mr-1" /> Adjustment
              </Button>
            )}
          </div>
          <DataTable
            table={adjustmentTable}
            className="min-w-[700px] text-xs "
          />
          <div className="flex justify-between items-center mt-2 px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800/50 border  rounded-b-md">
            <div className="flex-grow">Total</div>
            <div className="w-1/4 text-right">
              {formatCurrency(totalAdjustments)}
            </div>
            {!readOnly && <div className="w-[50px]"></div>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4">
          <div className="flex flex-col lg:flex-row justify-between items-start pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <div className="w-full lg:w-3/5 mb-4 lg:mb-0 lg:pr-8">
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="notesInput"
                  className="block text-sm font-semibold"
                >
                  Notes
                </label>
              </div>
              {isEditingNotes ? (
                <Input
                  id="notesInput"
                  autoFocus
                  value={notes ?? ''}
                  onChange={handleNotesChange}
                  onBlur={() => setEditing(null)}
                  onKeyDown={handleNotesKeyDown}
                  className="text-xs"
                  aria-label="Edit notes"
                />
              ) : (
                <div
                  id="notesDisplay"
                  className={`min-h-[36px] w-full px-3 py-2 text-xs rounded border border-transparent ${!readOnly ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/40' : 'text-zinc-600 dark:text-zinc-400'}`}
                  tabIndex={readOnly ? -1 : 0}
                  onClick={handleNotesEditStart}
                  onKeyDown={handleNotesKeyDownDiv}
                  role={!readOnly ? 'button' : undefined}
                  aria-label={readOnly ? 'Notes' : 'Click to edit notes'}
                >
                  {notes || (
                    <span className="text-zinc-400 dark:text-zinc-500 italic">
                      {readOnly
                        ? 'No notes provided.'
                        : 'Click to add notes...'}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="text-right w-full lg:w-2/5 lg:pl-8 lg:border-l lg:border-zinc-200 dark:lg:border-zinc-700">
              <div className="text-sm font-semibold mb-1">
                Grand Total/Disbursement
              </div>
              <div
                className={`text-2xl font-bold ${grandTotalDisbursement >= 0 ? 'text-green-700 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}
              >
                {formatCurrency(Math.abs(grandTotalDisbursement))}
                {grandTotalDisbursement < 0 && ' (Owed)'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
