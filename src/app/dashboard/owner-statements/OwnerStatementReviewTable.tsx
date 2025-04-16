import {
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
  onChange: (field: string, value: any) => void
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

  return (
    <Card className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-bold">Owner Statement</div>
        <div className="text-right">
          <div className="font-semibold">{propertyName}</div>
          <div className="text-sm text-zinc-500">
            {dayjs(statementMonth).format('MMMM - YYYY')}
          </div>
        </div>
      </div>
      {/* Income Table */}
      <div className="mb-6">
        <div className="font-semibold mb-1">Income:</div>
        <Table>
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
            </TableRow>
          </TableHead>
          <TableBody>
            {incomes.map((inc: any, i: number) => (
              <TableRow key={i}>
                <TableCell>{dayjs(inc.checkIn).format('YYYY-MM-DD')}</TableCell>
                <TableCell>
                  {dayjs(inc.checkOut).format('YYYY-MM-DD')}
                </TableCell>
                <TableCell>{inc.days}</TableCell>
                <TableCell>{inc.platform}</TableCell>
                <TableCell>{inc.guest}</TableCell>
                <TableCell align="right">
                  {inc.grossRevenue?.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                <TableCell align="right">
                  {inc.hostFee?.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                <TableCell align="right">
                  {inc.platformFee?.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
                <TableCell align="right">
                  {inc.grossIncome?.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold">
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
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {/* Expenses Table */}
      <div className="mb-6">
        <div className="font-semibold mb-1">Expenses:</div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Vendor</TableHeader>
              <TableHeader align="right">Amount</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.map((exp: any, i: number) => (
              <TableRow key={i}>
                <TableCell>{dayjs(exp.date).format('YYYY-MM-DD')}</TableCell>
                <TableCell>{exp.description}</TableCell>
                <TableCell>{exp.vendor}</TableCell>
                <TableCell align="right">
                  {exp.amount?.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold">
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell align="right">
                {totalExpenses.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {/* Adjustments Table */}
      <div className="mb-6">
        <div className="font-semibold mb-1">Adjustments:</div>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Check In</TableHeader>
              <TableHeader>Check Out</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader align="right">Amount</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {adjustments.map((adj: any, i: number) => (
              <TableRow key={i}>
                <TableCell>
                  {adj.checkIn ? dayjs(adj.checkIn).format('YYYY-MM-DD') : ''}
                </TableCell>
                <TableCell>
                  {adj.checkOut ? dayjs(adj.checkOut).format('YYYY-MM-DD') : ''}
                </TableCell>
                <TableCell>{adj.description}</TableCell>
                <TableCell align="right">
                  {adj.amount?.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  })}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold">
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell align="right">
                {totalAdjustments.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                })}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {/* Notes and Grand Total */}
      <div className="flex justify-between items-center mt-6">
        <div className="w-2/3">
          <label className="block text-sm font-medium mb-1">Notes</label>
          <Input
            value={notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Add notes..."
            disabled={readOnly}
          />
        </div>
        <div className="text-right w-1/3">
          <div className="font-semibold">Grand Total/Disbursement</div>
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
