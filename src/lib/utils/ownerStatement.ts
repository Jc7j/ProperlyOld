import { type Prisma } from '@prisma/client'

/**
 * Shared utility functions for Owner Statement calculations
 * Used by both tRPC router and API routes to ensure consistent calculations
 */

// Safe decimal parsing function - handles Prisma Decimal objects and various input types
export const safeParseDecimal = (value: any): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'object' && value.toString) {
    return parseFloat(value.toString()) || 0
  }
  return parseFloat(String(value)) || 0
}

// Calculate totals from individual items - ensures consistent calculation logic
export function calculateTotals(
  incomes: any[],
  expenses: any[],
  adjustments: any[]
) {
  const totalIncome = incomes.reduce(
    (sum, i) => sum + safeParseDecimal(i.grossIncome),
    0
  )
  const totalExpenses = expenses.reduce(
    (sum, e) => sum + safeParseDecimal(e.amount),
    0
  )
  const totalAdjustments = adjustments.reduce(
    (sum, a) => sum + safeParseDecimal(a.amount),
    0
  )

  return {
    totalIncome: parseFloat(totalIncome.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    totalAdjustments: parseFloat(totalAdjustments.toFixed(2)),
    grandTotal: parseFloat(
      (totalIncome - totalExpenses + totalAdjustments).toFixed(2)
    ),
  }
}

// Proper statement total recalculation - ensures data consistency
export async function recalculateStatementTotals(
  tx: Prisma.TransactionClient,
  statementId: string,
  userId: string,
  includeRelations?: boolean
) {
  const [incomes, expenses, adjustments] = await Promise.all([
    tx.ownerStatementIncome.findMany({
      where: { ownerStatementId: statementId },
    }),
    tx.ownerStatementExpense.findMany({
      where: { ownerStatementId: statementId },
    }),
    tx.ownerStatementAdjustment.findMany({
      where: { ownerStatementId: statementId },
    }),
  ])

  const totals = calculateTotals(incomes, expenses, adjustments)

  return tx.ownerStatement.update({
    where: { id: statementId },
    data: {
      ...totals,
      updatedAt: new Date(),
      updatedBy: userId,
    },
    ...(includeRelations && {
      include: {
        property: true,
        incomes: true,
        expenses: true,
        adjustments: true,
      },
    }),
  })
}

// Property name normalization function - ensures consistent property matching
export const normalizePropertyName = (name: string): string => {
  return name
    .replace(/\s*\((OLD|NEW)\)\s*$/i, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}
