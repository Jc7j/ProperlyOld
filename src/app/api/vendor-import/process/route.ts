import { auth } from '@clerk/nextjs/server'
import { type Prisma } from '@prisma/client'
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { geminiFlashModel } from '~/lib/gemini/gemini'
import { parseJsonField } from '~/lib/utils/json'
import { db } from '~/server/db'

const inputSchema = z.object({
  currentStatementId: z.string(),
  vendor: z.string(),
  description: z.string(),
  pdfBase64: z.string(),
})

// Safe decimal parsing function - same as in ownerStatement.ts
const safeParseDecimal = (value: any): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'object' && value.toString) {
    return parseFloat(value.toString()) || 0
  }
  return parseFloat(String(value)) || 0
}

// Calculate totals from individual items - same logic as ownerStatement.ts
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

// Proper statement total recalculation - same as ownerStatement.ts
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

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.orgId || !session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await request.json()
    const input = inputSchema.parse(body)

    // Get current statement first
    const current = await db.ownerStatement.findUnique({
      where: { id: input.currentStatementId },
      select: { statementMonth: true, managementGroupId: true },
    })

    if (!current || current.managementGroupId !== session.orgId) {
      throw new Error('Statement not found')
    }

    // Parallel queries with known month
    const [monthStatements, existingExpense] = await Promise.all([
      db.ownerStatement.findMany({
        where: {
          managementGroupId: session.orgId,
          statementMonth: current.statementMonth,
          deletedAt: null,
        },
        select: {
          id: true,
          property: { select: { name: true } },
        },
      }),
      db.ownerStatementExpense.findFirst({
        where: {
          ownerStatement: {
            managementGroupId: session.orgId,
            statementMonth: current.statementMonth,
          },
          vendor: input.vendor,
          description: input.description,
        },
        select: { id: true },
      }),
    ])

    if (existingExpense) {
      throw new Error(
        `Vendor "${input.vendor}" with description "${input.description}" already has expenses for this month`
      )
    }

    // AI Processing
    if (!geminiFlashModel) {
      throw new Error('AI service unavailable')
    }

    const propertyNames = monthStatements
      .map((s) => s.property?.name)
      .filter(Boolean)

    const prompt = `Extract expense data from this table-based invoice PDF.

EXPECTED OUTPUT: JSON object where each key is a property name/address from the invoice, and each value is an array of expense objects.

PROPERTY MATCHING: Use the property names/addresses EXACTLY as they appear in the invoice, then match them to these known properties:
${propertyNames.map((name) => `- ${name}`).join('\n')}

EXTRACTION RULES:
1. Find the main table/list of properties and their associated costs
2. For each property row, extract:
   - The property name/address (exactly as shown)
   - The total amount/cost for that property
   - Use the invoice date or leave date empty if not clear per line

COMMON INVOICE PATTERNS:
- Property name + total amount (e.g., "Arrowbrook: $760.00")
- Property address + unit price (e.g., "5405 Royal Yacht $235")
- Property address + multiple line items (e.g., "Address: TRASH $40, LANDSCAPING $55")

OUTPUT FORMAT:
{
  "Property Name/Address": [{"date": "YYYY-MM-DD or empty", "amount": number}]
}

EXAMPLE:
{
  "Arrowbrook": [{"date": "", "amount": 760.00}],
  "5405 Royal Yacht": [{"date": "", "amount": 235.00}],
  "3696 Barcelona St": [{"date": "", "amount": 95.00}]
}

IMPORTANT:
- Extract the total cost per property (if multiple line items, sum them)
- Use property names/addresses exactly as they appear in the invoice
- Respond with ONLY the JSON object, no explanations`

    const aiResult = await geminiFlashModel.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: input.pdfBase64,
        },
      },
    ])

    // Parse AI response
    const jsonText = aiResult.response?.text() ?? '{}'
    const jsonMatch = /\{[\s\S]*\}/.exec(jsonText)
    const extractedJson = jsonMatch ? jsonMatch[0] : '{}'

    const expensesMap = parseJsonField<
      Record<string, Array<{ date?: string; amount: number }>>
    >(extractedJson, { defaultValue: {} })

    if (!expensesMap || Object.keys(expensesMap).length === 0) {
      throw new Error('No property expenses found in PDF')
    }

    // Process all expenses in batches for better performance
    const defaultDate = new Date(current.statementMonth)
    defaultDate.setUTCDate(15)
    const defaultDateStr = defaultDate.toISOString().split('T')[0]!

    // Prepare all expense data
    const allExpenseData: Array<{
      ownerStatementId: string
      date: string
      description: string
      vendor: string
      amount: number
    }> = []
    const statementsToUpdate = new Set<string>()

    // Property name normalization function - same as ownerStatement.ts
    const normalizePropertyName = (name: string): string => {
      return name
        .replace(/\s*\((OLD|NEW)\)\s*$/i, '')
        .replace(/\s+/g, '')
        .toLowerCase()
    }

    for (const [propertyName, expenses] of Object.entries(expensesMap)) {
      // Try exact match first, then normalized match
      let statement = monthStatements.find(
        (s) => s.property?.name === propertyName
      )

      if (!statement) {
        const normalizedPropertyName = normalizePropertyName(propertyName)
        statement = monthStatements.find((s) => {
          if (!s.property?.name) return false
          const normalizedDbName = normalizePropertyName(s.property.name)
          return normalizedDbName === normalizedPropertyName
        })
      }

      if (!statement || expenses.length === 0) continue

      statementsToUpdate.add(statement.id)

      for (const expense of expenses) {
        allExpenseData.push({
          ownerStatementId: statement.id,
          date: expense.date ?? defaultDateStr,
          description: input.description,
          vendor: input.vendor,
          amount: expense.amount,
        })
      }
    }

    if (allExpenseData.length === 0) {
      throw new Error('No matching properties found for expenses')
    }

    // Process all expenses and update totals in a single transaction
    // This ensures data consistency and uses the same reliable calculation logic as other imports
    await db.$transaction(async (tx) => {
      // Create all expenses
      await tx.ownerStatementExpense.createMany({
        data: allExpenseData,
      })

      // Recalculate totals for each affected statement using the same logic as ownerStatement.ts
      // Process in smaller batches to avoid overwhelming the transaction
      const statementIds = Array.from(statementsToUpdate)
      const BATCH_SIZE = 5

      for (let i = 0; i < statementIds.length; i += BATCH_SIZE) {
        const batch = statementIds.slice(i, i + BATCH_SIZE)

        // Process each statement in the batch
        await Promise.all(
          batch.map((statementId) =>
            recalculateStatementTotals(tx, statementId, session.userId)
          )
        )
      }
    })

    const processedCount = statementsToUpdate.size

    return Response.json({
      success: true,
      message: `Successfully processed expenses for ${processedCount} properties`,
      updatedCount: processedCount,
    })
  } catch (error) {
    console.error('Processing error:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
