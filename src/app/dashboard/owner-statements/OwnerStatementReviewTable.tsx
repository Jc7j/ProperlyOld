import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui'
import dayjs from '~/lib/utils/day'

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
    (sum: number, i: any) => sum + (i.grossIncome || 0),
    0
  )
  const totalGrossRevenue = incomes.reduce(
    (sum: number, i: any) => sum + (i.grossRevenue || 0),
    0
  )
  const totalHostFee = incomes.reduce(
    (sum: number, i: any) => sum + (i.hostFee || 0),
    0
  )
  const totalPlatformFee = incomes.reduce(
    (sum: number, i: any) => sum + (i.platformFee || 0),
    0
  )
  const totalDays = incomes.reduce(
    (sum: number, i: any) => sum + (i.days || 0),
    0
  )
  const totalExpenses = expenses.reduce(
    (sum: number, e: any) => sum + (e.amount || 0),
    0
  )
  const totalAdjustments = adjustments.reduce(
    (sum: number, a: any) => sum + (a.amount || 0),
    0
  )
  const grandTotalDisbursement =
    grandTotal ?? totalIncome - totalExpenses + totalAdjustments

  // Track which cell is being edited
  const [editing, setEditing] = useState<{
    section: 'incomes' | 'expenses' | 'adjustments' | 'notes'
    rowIdx: number
    field: string
  } | null>(null)

  // Handlers for editing
  const handleEditStart = (
    section: 'incomes' | 'expenses' | 'adjustments' | 'notes',
    rowIdx: number,
    field: string
  ) => {
    if (readOnly) return
    setEditing({ section, rowIdx, field })
  }
  const handleEditSave = (
    section: 'incomes' | 'expenses' | 'adjustments' | 'notes',
    rowIdx: number,
    field: string
  ) => {
    if (section === 'notes') {
      onChange('notes', rowIdx, field, notes)
      setEditing(null)
      return
    }
    const arr = [...statementDraft[section]]
    arr[rowIdx] = { ...arr[rowIdx], [field]: notes }
    onChange(section, rowIdx, field, arr[rowIdx][field])
    setEditing(null)
  }

  const handleDelete = (field: string, idx: number) => {
    onChange(field, idx, '__delete', undefined)
  }
  const handleAdd = (field: string, template: any) => {
    onChange(field, -1, '__add', template)
  }

  const renderCell = (
    section: 'incomes' | 'expenses' | 'adjustments',
    rowIdx: number,
    field: string,
    value: any,
    type: 'text' | 'number' = 'text',
    alignRight = false
  ) => {
    const isEditing =
      !readOnly &&
      editing &&
      editing.section === section &&
      editing.rowIdx === rowIdx &&
      editing.field === field
    if (isEditing) {
      return (
        <Input
          autoFocus
          type={type === 'number' ? 'number' : 'text'}
          value={value ?? ''}
          className={`w-full px-2 py-1 text-xs border border-primary/40 rounded focus:outline-none focus:ring-1 focus:ring-primary/70 ${alignRight ? 'text-right' : ''}`}
          onChange={(e) => {
            let v: string | number | null = e.target.value
            if (type === 'number') {
              v = v === '' ? null : Number(v)
            }
            onChange(section, rowIdx, field, v)
          }}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditing(null)
          }}
        />
      )
    }
    const displayValue = () => {
      if (type === 'number') {
        return typeof value === 'number' ? (
          value.toLocaleString('en-US', { maximumFractionDigits: 2 })
        ) : (
          <span className="text-zinc-400 dark:text-zinc-600">—</span>
        )
      } else if (['checkIn', 'checkOut', 'date'].includes(field) && value) {
        const formatted = dayjs(value).isValid()
          ? dayjs(value).format('YYYY-MM-DD')
          : value
        return (
          formatted || (
            <span className="text-zinc-400 dark:text-zinc-600">—</span>
          )
        )
      } else {
        return (
          value || <span className="text-zinc-400 dark:text-zinc-600">—</span>
        )
      }
    }

    return (
      <div
        className={`min-h-[36px] px-2 py-1.5 text-xs ${alignRight ? 'text-right' : 'text-left'} ${!readOnly ? 'cursor-pointer rounded hover:bg-primary/5 dark:hover:bg-primary/10 focus-within:bg-primary/10 dark:focus-within:bg-primary/20 focus:outline-none focus-within:ring-1 focus-within:ring-primary/40' : 'text-zinc-700 dark:text-zinc-300'}`}
        tabIndex={readOnly ? -1 : 0}
        onClick={() => !readOnly && handleEditStart(section, rowIdx, field)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleEditStart(section, rowIdx, field)
        }}
      >
        {displayValue()}
      </div>
    )
  }

  return (
    <Card className="mx-auto p-4">
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
      <div className="overflow-x-auto relative">
        {/* Income Table */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
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
                className="text-xs px-2 py-1"
              >
                <Plus className="w-4 h-4 " /> Income
              </Button>
            )}
          </div>
          <Table striped className="min-w-[800px] text-xs">
            <TableHead>
              <TableRow>
                <TableHeader>Check In</TableHeader>
                <TableHeader>Check Out</TableHeader>
                <TableHeader>Days</TableHeader>
                <TableHeader>Platform</TableHeader>
                <TableHeader>Guest</TableHeader>
                <TableHeader align="right">Gross Revenue</TableHeader>
                <TableHeader align="right">Host Fee</TableHeader>
                <TableHeader align="right">Platform Fee</TableHeader>
                <TableHeader align="right">Gross Income</TableHeader>
                {!readOnly && <TableHeader className="w-[50px]" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {incomes.map((inc: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    {renderCell('incomes', i, 'checkIn', inc.checkIn, 'text')}
                  </TableCell>
                  <TableCell>
                    {renderCell('incomes', i, 'checkOut', inc.checkOut, 'text')}
                  </TableCell>
                  <TableCell>
                    {renderCell('incomes', i, 'days', inc.days, 'number')}
                  </TableCell>
                  <TableCell>
                    {renderCell('incomes', i, 'platform', inc.platform)}
                  </TableCell>
                  <TableCell>
                    {renderCell('incomes', i, 'guest', inc.guest)}
                  </TableCell>
                  <TableCell align="right">
                    {renderCell(
                      'incomes',
                      i,
                      'grossRevenue',
                      inc.grossRevenue,
                      'number',
                      true
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {renderCell(
                      'incomes',
                      i,
                      'hostFee',
                      inc.hostFee,
                      'number',
                      true
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {renderCell(
                      'incomes',
                      i,
                      'platformFee',
                      inc.platformFee,
                      'number',
                      true
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {renderCell(
                      'incomes',
                      i,
                      'grossIncome',
                      inc.grossIncome,
                      'number',
                      true
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="w-[50px]">
                      <Button
                        variant="destructiveOutline"
                        onClick={() => handleDelete('incomes', i)}
                        aria-label="Delete row"
                        className="flex items-center justify-center p-0 rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="font-medium bg-zinc-50 dark:bg-zinc-800/50 border-t">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell>{totalDays}</TableCell>
                <TableCell colSpan={2}></TableCell>
                <TableCell align="right">
                  {totalGrossRevenue.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                <TableCell align="right">
                  {totalHostFee.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                <TableCell align="right">
                  {totalPlatformFee.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                <TableCell align="right">
                  {totalIncome.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                {!readOnly && <TableCell></TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {/* Expenses Table */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
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
                className="text-xs px-2 py-1"
              >
                <Plus className="w-4 h-4" /> Expense
              </Button>
            )}
          </div>
          <Table striped className="min-w-[600px] text-xs">
            <TableHead>
              <TableRow>
                <TableHeader>Date</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Vendor</TableHeader>
                <TableHeader align="right">Amount</TableHeader>
                {!readOnly && <TableHeader className="w-[50px]" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((exp: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    {renderCell('expenses', i, 'date', exp.date, 'text')}
                  </TableCell>
                  <TableCell>
                    {renderCell('expenses', i, 'description', exp.description)}
                  </TableCell>
                  <TableCell>
                    {renderCell('expenses', i, 'vendor', exp.vendor)}
                  </TableCell>
                  <TableCell align="right">
                    {renderCell(
                      'expenses',
                      i,
                      'amount',
                      exp.amount,
                      'number',
                      true
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="w-[50px]">
                      <Button
                        variant="destructiveOutline"
                        onClick={() => handleDelete('expenses', i)}
                        aria-label="Delete row"
                        className="flex items-center justify-center p-0 rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="font-medium bg-zinc-50 dark:bg-zinc-800/50 border-t">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell align="right">
                  {totalExpenses.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                {!readOnly && <TableCell></TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {/* Adjustments Table */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
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
                className="text-xs px-2 py-1"
              >
                <Plus className="w-4 h-4" /> Adjustment
              </Button>
            )}
          </div>
          <Table striped className="min-w-[700px] text-xs">
            <TableHead>
              <TableRow>
                <TableHeader>Check In</TableHeader>
                <TableHeader>Check Out</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader align="right">Amount</TableHeader>
                {!readOnly && <TableHeader className="w-[50px]" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {adjustments.map((adj: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    {renderCell(
                      'adjustments',
                      i,
                      'checkIn',
                      adj.checkIn,
                      'text'
                    )}
                  </TableCell>
                  <TableCell>
                    {renderCell(
                      'adjustments',
                      i,
                      'checkOut',
                      adj.checkOut,
                      'text'
                    )}
                  </TableCell>
                  <TableCell>
                    {renderCell(
                      'adjustments',
                      i,
                      'description',
                      adj.description
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {renderCell(
                      'adjustments',
                      i,
                      'amount',
                      adj.amount,
                      'number',
                      true
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="w-[50px]">
                      <Button
                        variant="destructiveOutline"
                        onClick={() => handleDelete('adjustments', i)}
                        aria-label="Delete row"
                        className="flex items-center justify-center p-0 rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="font-medium bg-zinc-50 dark:bg-zinc-800/50 border-t">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell align="right">
                  {totalAdjustments.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                {!readOnly && <TableCell></TableCell>}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Notes and Grand Total */}
      <div className="flex flex-col lg:flex-row justify-between items-start mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <div className="w-full lg:w-3/5 mb-4 lg:mb-0 lg:pr-8">
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="notesInput" className="block text-sm font-semibold">
              Notes
            </label>
          </div>
          {editing && editing.section === 'notes' ? (
            <Input
              autoFocus
              value={notes}
              onChange={(e) => onChange('notes', 0, 'notes', e.target.value)}
              onBlur={() => handleEditSave('notes', 0, 'notes')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditing(null)
              }}
              className="text-xs"
            />
          ) : (
            <div
              id="notesDisplay"
              className={`min-h-[36px] px-3 py-2 text-xs rounded border border-transparent ${!readOnly ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary/40' : 'text-zinc-600 dark:text-zinc-400'}`}
              tabIndex={readOnly ? -1 : 0}
              onClick={() => !readOnly && handleEditStart('notes', 0, 'notes')}
              onKeyDown={(e) => {
                if (!readOnly && e.key === 'Enter')
                  handleEditStart('notes', 0, 'notes')
              }}
              role={!readOnly ? 'button' : undefined}
            >
              {notes || (
                <span className="text-zinc-400 dark:text-zinc-500 italic">
                  {readOnly ? 'No notes provided.' : 'Click to add notes...'}
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
            {Math.abs(grandTotalDisbursement).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
            })}
            {grandTotalDisbursement < 0 && ' (Owed)'}
          </div>
        </div>
      </div>
    </Card>
  )
}
