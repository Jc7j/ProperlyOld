import {
  type ColumnDef,
  type Row,
  type Table,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'
import {  useEffect, useMemo, useState } from 'react'
import { DataTable } from '~/components/table/data-table'
import { Button, Card, Input } from '~/components/ui'
import { ErrorToast, SuccessToast } from '~/components/ui/sonner'
import dayjs from '~/lib/utils/day'
import { formatCurrency } from '~/lib/utils/format'
import { api } from '~/trpc/react'

export interface FullOwnerStatementType {
  id: string
  propertyId: string
  propertyName: string
  statementMonth: string | Date
  notes: string | null
  incomes: IncomeItem[]
  expenses: ExpenseItem[]
  adjustments: AdjustmentItem[]
  totalIncome: number | null
  totalExpenses: number | null
  totalAdjustments: number | null
  grandTotal: number | null
  property?: { name: string; [key: string]: any }
  [key: string]: any
}

interface IncomeItem {
  id?: string
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
  statementId?: string
  utils?: any
}

interface OwnerStatementReviewTableProps {
  statementDraft: any
  readOnly?: boolean
  statementId?: string
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
    const [editValue, setEditValue] = useState<string>('')

    const updateItemMutation = api.ownerStatement.updateItemField.useMutation({
      onSuccess: () => {
        SuccessToast('Updated successfully')
      },
      onError: (error) => {
        ErrorToast(`Failed to update item: ${error.message}`)
      },
    })

    const meta = (table.options as any).meta as TableMeta | undefined

    if (!meta) {
      return <span className="text-red-500 text-xs">Meta Error</span>
    }

    const { editing, setEditing, onChange, readOnly, section, statementId, utils } =
      meta
    const field: string = column.id!
    const rowIdx = row.index

    const isEditing =
      !readOnly &&
      editing?.section === section &&
      editing?.rowIdx === rowIdx &&
      editing?.field === field

    const handleBlur = () => {
      setEditing(null)
      const item = row.original as TData & { id?: string }

      const originalValueString =
        typeof initialValue === 'object' && initialValue !== null
          ? ''
          : String(initialValue ?? '')
      const changedDuringEdit = editValue !== originalValueString

      let processedValue: string | number | null

      if (type === 'number') {
        if (editValue.trim() === '') {
          processedValue = 0
        } else {
          const num = Number(editValue)
          if (isNaN(num)) {
            ErrorToast(`Invalid number: ${editValue}. Reverting.`)
            onChange(section, rowIdx, field, initialValue)
            return
          }
          processedValue = num
        }
      } else {
        if (
          section === 'adjustments' &&
          (field === 'checkIn' || field === 'checkOut') &&
          editValue.trim() === ''
        ) {
          processedValue = null
        } else {
          processedValue = editValue
        }
      }

      onChange(section, rowIdx, field, processedValue)

      if (
        statementId &&
        item.id &&
        item.id !== 'temp-id' &&
        changedDuringEdit
      ) {
        updateItemMutation.mutate(
          {
            id: item.id,
            section: section,
            field: field,
            value: processedValue,
          },
          {
            onSuccess: () => {
              if (utils && statementId) {
                void utils.ownerStatement.getOne.invalidate({ id: statementId })
              }
            },
          }
        )
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.currentTarget.blur()
      }
    }

    const handleEditStart = () => {
      if (!readOnly) {
        setEditing({ section, rowIdx, field })
        setEditValue(
          typeof initialValue === 'object' && initialValue !== null
            ? ''
            : String(initialValue ?? '')
        )
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
          id={`edit-${section}-${rowIdx}-${field}`}
          type={type === 'number' ? 'number' : 'text'}
          value={editValue}
          className={`h-auto w-full border border-primary/40 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/70 ${alignRight ? 'text-right' : ''}`}
          onChange={(e) => setEditValue(e.target.value)}
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

      if (field === 'days') {
        return typeof value === 'number' || typeof value === 'string' ? (
          value.toLocaleString()
        ) : (
          <span className="text-red-500 text-xs">Invalid Days</span>
        )
      }

      if (type === 'number') {
        return typeof value === 'number' ? (
          formatCurrency(value, 'USD', { centsToDollars: false })
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
  readOnly = false,
  statementId,
}: OwnerStatementReviewTableProps) {
  const {
    incomes = [],
    expenses = [],
    adjustments = [],
    notes,
  } = statementDraft || {}

  // Calculate totals
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
  const grandTotalDisbursement = totalIncome - totalExpenses + totalAdjustments

  const [editing, setEditing] = useState<{
    section: string
    rowIdx: number
    field: string
  } | null>(null)
  
  const [notesValue, setNotesValue] = useState<string>('')
  
  const utils = api.useUtils()

  // Update notes mutation
  const updateNotesMutation = api.ownerStatement.updateNotes.useMutation({
    onSuccess: () => {
      SuccessToast('Notes updated successfully')
      void utils.ownerStatement.getOne.invalidate({ id: statementId })
    },
    onError: (error) => {
      ErrorToast(`Failed to update notes: ${error.message}`)
    },
  })

  // Sync notes value with prop
  useEffect(() => {
    setNotesValue(notes || '')
  }, [notes])

  // Create new item mutations
  const createIncomeMutation = api.ownerStatement.createIncomeItem.useMutation({
    onSuccess: () => {
      SuccessToast('Income item added successfully')
      // The UI will update automatically via the query refetch
    },
    onError: (error) => {
      ErrorToast(`Failed to add income: ${error.message}`)
    },
  })

  const createExpenseMutation = api.ownerStatement.createExpenseItem.useMutation({
    onSuccess: () => {
      SuccessToast('Expense item added successfully')
    },
    onError: (error) => {
      ErrorToast(`Failed to add expense: ${error.message}`)
    },
  })

  const createAdjustmentMutation = api.ownerStatement.createAdjustmentItem.useMutation({
    onSuccess: () => {
      SuccessToast('Adjustment item added successfully')
    },
    onError: (error) => {
      ErrorToast(`Failed to add adjustment: ${error.message}`)
    },
  })

  // Delete item mutations
  const deleteIncomeMutation = api.ownerStatement.deleteIncomeItem.useMutation({
    onSuccess: () => {
      SuccessToast('Income item deleted successfully')
    },
    onError: (error) => {
      ErrorToast(`Failed to delete income: ${error.message}`)
    },
  })

  const deleteExpenseMutation = api.ownerStatement.deleteExpenseItem.useMutation({
    onSuccess: () => {
      SuccessToast('Expense item deleted successfully')
    },
    onError: (error) => {
      ErrorToast(`Failed to delete expense: ${error.message}`)
    },
  })

  const deleteAdjustmentMutation = api.ownerStatement.deleteAdjustmentItem.useMutation({
    onSuccess: () => {
      SuccessToast('Adjustment item deleted successfully')
    },
    onError: (error) => {
      ErrorToast(`Failed to delete adjustment: ${error.message}`)
    },
  })

  // Handle adding new items
  const handleAddIncome = () => {
    if (!statementId) return
    createIncomeMutation.mutate({ ownerStatementId: statementId })
  }

  const handleAddExpense = () => {
    if (!statementId) return
    createExpenseMutation.mutate({ ownerStatementId: statementId })
  }

  const handleAddAdjustment = () => {
    if (!statementId) return
    createAdjustmentMutation.mutate({ ownerStatementId: statementId })
  }

  const handleDelete = (section: string, idx: number) => {
    const item = section === 'incomes' 
      ? incomes[idx] 
      : section === 'expenses' 
      ? expenses[idx] 
      : adjustments[idx]

    if (!item?.id) {
      ErrorToast('Cannot delete item: missing ID')
      return
    }

    // Call appropriate delete mutation based on section
    switch (section) {
      case 'incomes':
        deleteIncomeMutation.mutate({ id: item.id })
        break
      case 'expenses':
        deleteExpenseMutation.mutate({ id: item.id })
        break
      case 'adjustments':
        deleteAdjustmentMutation.mutate({ id: item.id })
        break
      default:
        ErrorToast('Unknown section type')
    }
  }

  const tableMeta = useMemo(
    () => ({
      editing,
      setEditing,
      onChange: (_section: string, _rowIdx: number, _key: string, _value: any) => {
        // No-op for now - direct server updates handled in cells
      },
      readOnly,
      handleDelete,
      statementId,
      utils,
    }),
    [editing, readOnly, statementId, utils]
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
        header: () => <div className="text-right">Check Out</div>,
        cell: createEditableCell('text', true),
      },
      {
        accessorKey: 'days',
        header: () => <div className="text-right">Days</div>,
        cell: createEditableCell('number', true),
      },
      {
        accessorKey: 'platform',
        header: () => <div className="text-right">Platform</div>,
        cell: createEditableCell('text', true),
      },
      {
        accessorKey: 'guest',
        header: () => <div className="text-right">Guest</div>,
        cell: createEditableCell('text', true),
      },
      {
        accessorKey: 'grossRevenue',
        header: () => <div className="text-right">Gross Revenue</div>,
        cell: createEditableCell('number', true),
      },
      {
        accessorKey: 'hostFee',
        header: () => <div className="text-right">Host Fee</div>,
        cell: createEditableCell('number', true),
      },
      {
        accessorKey: 'platformFee',
        header: () => <div className="text-right">Platform Fee</div>,
        cell: createEditableCell('number', true),
      },
      {
        accessorKey: 'grossIncome',
        header: () => <div className="text-right">Gross Income</div>,
        cell: createEditableCell('number', true),
      },
      ...(!readOnly
        ? [
            {
              id: 'actions',
              header: () => <div className="w-[50px] text-right"></div>,
              cell: ({
                row,
                table,
              }: {
                row: Row<IncomeItem>
                table: Table<IncomeItem>
              }) => (
                <div className="flex items-center justify-end w-[50px]">
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
        header: () => <div className="text-right">Description</div>,
        cell: createEditableCell('text', true),
      },
      {
        accessorKey: 'vendor',
        header: () => <div className="text-right">Vendor</div>,
        cell: createEditableCell('text', true),
      },
      {
        accessorKey: 'amount',
        header: () => <div className="text-right">Amount</div>,
        cell: createEditableCell('number', true),
      },
      ...(!readOnly
        ? [
            {
              id: 'actions',
              header: () => <div className="w-[50px] text-right"></div>,
              cell: ({
                row,
                table,
              }: {
                row: Row<ExpenseItem>
                table: Table<ExpenseItem>
              }) => (
                <div className="flex items-center justify-end w-[50px]">
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
        header: () => <div className="text-right">Check Out</div>,
        cell: createEditableCell('text', true),
      },
      {
        accessorKey: 'description',
        header: () => <div className="text-right">Description</div>,
        cell: createEditableCell('text', true),
      },
      {
        accessorKey: 'amount',
        header: () => <div className="text-right">Amount</div>,
        cell: createEditableCell('number', true),
      },
      ...(!readOnly
        ? [
            {
              id: 'actions',
              header: () => <div className="w-[50px] text-right"></div>,
              cell: ({
                row,
                table,
              }: {
                row: Row<AdjustmentItem>
                table: Table<AdjustmentItem>
              }) => (
                <div className="flex items-center justify-end w-[50px]">
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
      setNotesValue(notes || '')
      setEditing({ section: 'notes', rowIdx: 0, field: 'notes' })
    }
  }

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      handleNotesBlur()
    }
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotesValue(e.target.value)
  }

  const handleNotesBlur = () => {
    setEditing(null)
    if (statementId && notesValue !== (notes || '')) {
      updateNotesMutation.mutate({
        id: statementId,
        notes: notesValue.trim() === '' ? undefined : notesValue,
      })
    }
  }

  const handleNotesKeyDownDiv = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!readOnly && e.key === 'Enter') {
      handleNotesEditStart()
    }
  }

  return (
    <div className="space-y-6">

      <Card>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-sm font-semibold">Income:</div>
            {!readOnly && (
              <Button
                onClick={handleAddIncome}
                size="sm"
                className="h-auto px-2 py-1"
              >
                <Plus className="w-4 h-4 mr-1" /> Income
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <DataTable table={incomeTable} className="text-xs border-b" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                <tr className="font-medium bg-zinc-50 dark:bg-zinc-800/50">
                  <td className="px-3 py-2" style={{ width: '11.11%' }}>
                    Total
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '11.11%' }}
                  ></td>
                  <td className="px-3 py-2 text-right" style={{ width: '8%' }}>
                    {totalDays}
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '11.11%' }}
                  ></td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '11.11%' }}
                  ></td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '11.11%' }}
                  >
                    {formatCurrency(totalGrossRevenue, 'USD', {
                      centsToDollars: false,
                    })}
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '11.11%' }}
                  >
                    {formatCurrency(totalHostFee, 'USD', {
                      centsToDollars: false,
                    })}
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '11.11%' }}
                  >
                    {formatCurrency(totalPlatformFee, 'USD', {
                      centsToDollars: false,
                    })}
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '11.11%' }}
                  >
                    {formatCurrency(totalIncome, 'USD', {
                      centsToDollars: false,
                    })}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2" style={{ width: '50px' }}></td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-sm font-semibold">Expenses:</div>
            {!readOnly && (
              <Button
                onClick={handleAddExpense}
                size="sm"
                className="h-auto px-2 py-1"
              >
                <Plus className="w-4 h-4 mr-1" /> Expense
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <DataTable table={expenseTable} className="text-xs border-b" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                <tr className="font-medium bg-zinc-50 dark:bg-zinc-800/50">
                  <td className="px-3 py-2" style={{ width: '25%' }}>
                    Total
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '25%' }}
                  ></td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '25%' }}
                  ></td>
                  <td className="px-3 py-2 text-right" style={{ width: '25%' }}>
                    {formatCurrency(totalExpenses, 'USD', {
                      centsToDollars: false,
                    })}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2" style={{ width: '50px' }}></td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-sm font-semibold">Adjustments:</div>
            {!readOnly && (
              <Button
                onClick={handleAddAdjustment}
                size="sm"
                className="h-auto px-2 py-1"
              >
                <Plus className="w-4 h-4 mr-1" /> Adjustment
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <DataTable table={adjustmentTable} className="text-xs border-b" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>
                <tr className="font-medium bg-zinc-50 dark:bg-zinc-800/50">
                  <td className="px-3 py-2" style={{ width: '25%' }}>
                    Total
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '25%' }}
                  ></td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{ width: '25%' }}
                  ></td>
                  <td className="px-3 py-2 text-right" style={{ width: '25%' }}>
                    {formatCurrency(totalAdjustments, 'USD', {
                      centsToDollars: false,
                    })}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2" style={{ width: '50px' }}></td>
                  )}
                </tr>
              </tbody>
            </table>
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
                  value={notesValue}
                  onChange={handleNotesChange}
                  onBlur={handleNotesBlur}
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
                {formatCurrency(Math.abs(grandTotalDisbursement), 'USD', {
                  centsToDollars: false,
                })}
                {grandTotalDisbursement < 0 && ' (Owed)'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
