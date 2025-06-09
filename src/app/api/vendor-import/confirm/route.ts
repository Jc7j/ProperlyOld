import { auth } from '@clerk/nextjs/server'
import { type Prisma } from '@prisma/client'
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { VendorCache } from '~/lib/OwnerStatement/vendor-cache'
import type { VendorImportConfirmResponse } from '~/lib/OwnerStatement/vendor-import'
import { db } from '~/server/db'

const confirmSchema = z.object({
  currentStatementId: z.string(),
  approvedMatches: z.array(
    z.object({
      property: z.object({
        id: z.string(),
        name: z.string(),
        address: z.string().nullable().optional(),
      }),
      confidence: z.number(),
      reason: z.string().optional(),
      expenses: z.array(
        z.object({
          date: z.string(),
          description: z.string(),
          vendor: z.string(),
          amount: z.number(),
        })
      ),
      totalAmount: z.number(),
    })
  ),
})

// Safe decimal parsing function - same as in other files
const safeParseDecimal = (value: any): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'object' && value.toString) {
    return parseFloat(value.toString()) || 0
  }
  return parseFloat(String(value)) || 0
}

// Calculate totals from individual items
function calculateTotals(incomes: any[], expenses: any[], adjustments: any[]) {
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

async function recalculateStatementTotals(
  tx: Prisma.TransactionClient,
  statementId: string,
  userId: string
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
  })
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth()

  if (!session?.orgId || !session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await request.json()
    const input = confirmSchema.parse(body)

    if (input.approvedMatches.length === 0) {
      throw new Error('No approved matches provided')
    }

    // Verify the current statement exists and belongs to the org
    const current = await db.ownerStatement.findUnique({
      where: { id: input.currentStatementId },
      select: { statementMonth: true, managementGroupId: true },
    })

    if (!current || current.managementGroupId !== session.orgId) {
      throw new Error('Statement not found')
    }

    // Use cached month statements for validation (optimized)
    const monthKey = `${current.statementMonth.getUTCFullYear()}-${String(current.statementMonth.getUTCMonth() + 1).padStart(2, '0')}`

    let monthStatements = await VendorCache.getMonthStatements(
      session.orgId,
      monthKey
    )
    if (!monthStatements) {
      monthStatements = await db.ownerStatement.findMany({
        where: {
          managementGroupId: session.orgId,
          statementMonth: current.statementMonth,
          deletedAt: null,
        },
        select: {
          id: true,
          propertyId: true,
          property: {
            select: { id: true, name: true },
          },
        },
      })

      // Cache for future requests
      await VendorCache.setMonthStatements(
        session.orgId,
        monthKey,
        monthStatements
      )
    }

    // Create a map of property ID to statement ID for validation
    const propertyToStatementMap = new Map<string, string>()
    monthStatements.forEach((statement: any) => {
      if (statement.property) {
        propertyToStatementMap.set(statement.property.id, statement.id)
      }
    })

    // Validate that all approved property IDs exist and get their statement IDs
    const validatedMatches = input.approvedMatches.map((match) => {
      const statementId = propertyToStatementMap.get(match.property.id)
      if (!statementId) {
        throw new Error(
          `Property "${match.property.name}" not found in current month statements`
        )
      }
      return { ...match, statementId }
    })

    // Prepare all expense data for bulk creation
    const allExpenseData: Array<{
      ownerStatementId: string
      date: string
      description: string
      vendor: string
      amount: number
    }> = []

    const statementsToUpdate = new Set<string>()
    const updatedProperties = new Set<string>()

    for (const match of validatedMatches) {
      statementsToUpdate.add(match.statementId)
      updatedProperties.add(match.property.name)

      for (const expense of match.expenses) {
        allExpenseData.push({
          ownerStatementId: match.statementId,
          date: expense.date,
          description: expense.description,
          vendor: expense.vendor,
          amount: expense.amount,
        })
      }
    }

    // Optimized bulk processing with better transaction strategy
    const CHUNK_SIZE = 300 // Increased for better performance
    const chunks = chunkArray(allExpenseData, CHUNK_SIZE)
    let totalCreatedCount = 0

    // Process chunks with optimized parallel operations
    for (const chunk of chunks) {
      await db.$transaction(
        async (tx) => {
          // Create all expenses in one operation
          await tx.ownerStatementExpense.createMany({
            data: chunk,
            skipDuplicates: true, // Safety guard
          })

          // Get unique statement IDs for efficient updates
          const chunkStatementIds = [
            ...new Set(chunk.map((expense) => expense.ownerStatementId)),
          ]

          // Parallel recalculation for better performance
          await Promise.all(
            chunkStatementIds.map((statementId) =>
              recalculateStatementTotals(tx, statementId, session.userId)
            )
          )

          totalCreatedCount += chunk.length
        },
        {
          timeout: 15000, // 15 seconds timeout (Accelerate limit)
        }
      )
    }

    // Invalidate cache after successful creation
    await VendorCache.invalidateMonth(session.orgId, monthKey)

    const response: VendorImportConfirmResponse = {
      success: true,
      createdCount: totalCreatedCount,
      updatedPropertiesCount: updatedProperties.size,
      updatedProperties: Array.from(updatedProperties),
    }

    return Response.json(response)
  } catch (error) {
    console.error('Confirmation error:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
