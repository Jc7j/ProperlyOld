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
    statementMonth,
    incomes = [],
    expenses = [],
    adjustments = [],
    notes,
    grandTotal,
  } = statementDraft

  // Calculate totals
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

  // Render cell: read-only or input if editing
  const renderCell = (
    section: 'incomes' | 'expenses' | 'adjustments',
    rowIdx: number,
    field: string,
    value: any,
    type: 'text' | 'number' | 'date' = 'text',
    alignRight = false
  ) => {
    const isEditing =
      editing &&
      editing.section === section &&
      editing.rowIdx === rowIdx &&
      editing.field === field
    if (isEditing) {
      return (
        <Input
          autoFocus
          type={type}
          value={value ?? ''}
          onChange={(e) => {
            const v =
              type === 'number' ? Number(e.target.value) : e.target.value
            onChange(section, rowIdx, field, v)
          }}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setEditing(null)
          }}
          className={alignRight ? 'text-right' : ''}
        />
      )
    }
    return (
      <div
        className={`min-h-[36px] ${alignRight ? 'text-right' : ''} cursor-pointer px-1 py-1 rounded hover:bg-zinc-50 ${readOnly ? '' : 'border-b border-transparent hover:border-zinc-200'}`}
        tabIndex={0}
        onClick={() => handleEditStart(section, rowIdx, field)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleEditStart(section, rowIdx, field)
        }}
      >
        {type === 'number' && typeof value === 'number'
          ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
          : value || <span className="text-zinc-400">—</span>}
      </div>
    )
  }

  // Render add row
  const renderAddRow = (
    section: 'incomes' | 'expenses' | 'adjustments',
    template: any
  ) => (
    <TableRow>
      <TableCell colSpan={100} align="center">
        <Button
          outline
          onClick={() => handleAdd(section, template)}
          className="mx-auto"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Row
        </Button>
      </TableCell>
    </TableRow>
  )

  return (
    <Card className=" mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-bold">Owner Statement</div>
        <div className="text-right">
          <div className="font-semibold">{propertyName}</div>
          <div className="text-sm text-zinc-500">
            {dayjs(statementMonth).format('MMMM - YYYY')}
          </div>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {/* Income Table */}
        <div className="mb-8">
          <div className="text-lg font-semibold mb-2">Income:</div>
          <Table striped>
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
                <TableHeader />
              </TableRow>
            </TableHead>
            <TableBody>
              {incomes.map((inc: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    {renderCell('incomes', i, 'checkIn', inc.checkIn, 'date')}
                  </TableCell>
                  <TableCell>
                    {renderCell('incomes', i, 'checkOut', inc.checkOut, 'date')}
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
                  <TableCell>
                    <Button
                      outline
                      onClick={() => handleDelete('incomes', i)}
                      aria-label="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {renderAddRow('incomes', {
                checkIn: '',
                checkOut: '',
                days: 0,
                platform: '',
                guest: '',
                grossRevenue: 0,
                hostFee: 0,
                platformFee: 0,
                grossIncome: 0,
              })}
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
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {/* Expenses Table */}
        <div className="mb-8">
          <div className="text-lg font-semibold mb-2">Expenses:</div>
          <Table striped>
            <TableHead>
              <TableRow>
                <TableHeader>Date</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader>Vendor</TableHeader>
                <TableHeader align="right">Amount</TableHeader>
                <TableHeader />
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((exp: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>
                    {renderCell('expenses', i, 'date', exp.date, 'date')}
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
                  <TableCell>
                    <Button
                      outline
                      onClick={() => handleDelete('expenses', i)}
                      aria-label="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {renderAddRow('expenses', {
                date: '',
                description: '',
                vendor: '',
                amount: 0,
              })}
              <TableRow className="font-medium bg-zinc-50 dark:bg-zinc-800/50 border-t">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell align="right">
                  {totalExpenses.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {/* Adjustments Table */}
        <div className="mb-8">
          <div className="text-lg font-semibold mb-2">Adjustments:</div>
          <Table striped>
            <TableHead>
              <TableRow>
                <TableHeader>Check In</TableHeader>
                <TableHeader>Check Out</TableHeader>
                <TableHeader>Description</TableHeader>
                <TableHeader align="right">Amount</TableHeader>
                <TableHeader />
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
                      'date'
                    )}
                  </TableCell>
                  <TableCell>
                    {renderCell(
                      'adjustments',
                      i,
                      'checkOut',
                      adj.checkOut,
                      'date'
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
                  <TableCell>
                    <Button
                      outline
                      onClick={() => handleDelete('adjustments', i)}
                      aria-label="Delete row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {renderAddRow('adjustments', {
                checkIn: '',
                checkOut: '',
                description: '',
                amount: 0,
              })}
              <TableRow className="font-medium bg-zinc-50 dark:bg-zinc-800/50 border-t">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell align="right">
                  {totalAdjustments.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Notes and Grand Total */}
      <div className="flex justify-between items-start mt-8 pt-6 border-t">
        <div className="w-2/3">
          <label className="block text-sm font-medium mb-1">Notes</label>
          {editing && editing.section === 'notes' ? (
            <Input
              autoFocus
              value={notes}
              onChange={(e) => onChange('notes', 0, 'notes', e.target.value)}
              onBlur={() => handleEditSave('notes', 0, 'notes')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditing(null)
              }}
            />
          ) : (
            <div
              className="min-h-[36px] cursor-pointer px-1 py-1 rounded hover:bg-zinc-50 border-b border-transparent hover:border-zinc-200"
              tabIndex={0}
              onClick={() => handleEditStart('notes', 0, 'notes')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditStart('notes', 0, 'notes')
              }}
            >
              {notes || <span className="text-zinc-400">Add notes...</span>}
            </div>
          )}
        </div>
        <div className="text-right w-1/3">
          <div className="text-lg font-semibold mb-1">
            Grand Total/Disbursement
          </div>
          <div className="text-2xl font-bold text-green-700">
            {grandTotalDisbursement.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
