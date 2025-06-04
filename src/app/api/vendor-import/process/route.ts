import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { geminiFlashModel } from '~/lib/gemini/gemini'
import { verifyQStashSignature } from '~/lib/qstash/qstash'
import { parseJsonField } from '~/lib/utils/json'
import { tryCatch } from '~/lib/utils/try-catch'
import { db } from '~/server/db'

const jobSchema = z.object({
  currentStatementId: z.string(),
  vendor: z.string(),
  description: z.string(),
  pdfBase64: z.string(),
  orgId: z.string(),
  userId: z.string(),
  jobId: z.string(),
})

// Simple in-memory job status (for single user, this is fine)
const jobResults = new Map<
  string,
  {
    status: 'processing' | 'completed' | 'failed'
    result?: any
    error?: string
  }
>()

export async function POST(request: NextRequest) {
  try {
    // Verify QStash signature
    const body = await request.text()
    const isValid = await verifyQStashSignature(request.headers, body)

    if (!isValid) {
      return new Response('Unauthorized', { status: 401 })
    }

    const input = jobSchema.parse(JSON.parse(body))

    // Set job as processing
    jobResults.set(input.jobId, { status: 'processing' })

    // Get current statement and month statements
    const current = await db.ownerStatement.findUnique({
      where: { id: input.currentStatementId },
      select: { statementMonth: true, managementGroupId: true },
    })

    if (!current || current.managementGroupId !== input.orgId) {
      throw new Error('Statement not found')
    }

    const monthStatements = await db.ownerStatement.findMany({
      where: {
        managementGroupId: input.orgId,
        statementMonth: current.statementMonth,
        deletedAt: null,
      },
      select: {
        id: true,
        property: { select: { name: true } },
      },
    })

    // Check for existing vendor expenses
    const existingExpenses = await db.ownerStatementExpense.findMany({
      where: {
        ownerStatementId: { in: monthStatements.map((s) => s.id) },
        vendor: input.vendor,
        description: input.description,
      },
      select: {
        ownerStatement: { select: { property: { select: { name: true } } } },
      },
    })

    if (existingExpenses.length > 0) {
      const properties = existingExpenses
        .map((e) => e.ownerStatement.property?.name)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ')

      throw new Error(
        `Vendor "${input.vendor}" already has expenses in: ${properties}`
      )
    }

    // AI Processing
    if (!geminiFlashModel) {
      throw new Error('AI service unavailable')
    }

    const propertyNames = monthStatements
      .map((s) => s.property?.name)
      .filter(Boolean)

    const prompt = `Extract expenses from this PDF and match to these properties:
${propertyNames.map((name) => `- ${name}`).join('\n')}

Return JSON: {"Property Name": [{"date": "YYYY-MM-DD", "amount": 123.45}]}
If no matches, return {}.`

    const result = await tryCatch(
      geminiFlashModel.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: input.pdfBase64,
          },
        },
      ])
    )

    if (result.error) {
      throw new Error('AI processing failed')
    }

    // Parse AI response
    const jsonText = result.data.response?.text() ?? '{}'
    const jsonMatch = /\{[\s\S]*\}/.exec(jsonText)
    const extractedJson = jsonMatch ? jsonMatch[0] : '{}'

    const expensesMap = parseJsonField<
      Record<string, Array<{ date?: string; amount: number }>>
    >(extractedJson, { defaultValue: {} })

    if (!expensesMap || Object.keys(expensesMap).length === 0) {
      throw new Error('No expenses found in PDF')
    }

    // Process expenses
    const defaultDate = new Date(current.statementMonth)
    defaultDate.setUTCDate(15)
    const defaultDateStr = defaultDate.toISOString().split('T')[0]!

    let processedCount = 0
    const updatedProperties: string[] = []

    for (const [propertyName, expenses] of Object.entries(expensesMap)) {
      const statement = monthStatements.find(
        (s) => s.property?.name === propertyName
      )

      if (!statement || expenses.length === 0) continue

      await db.$transaction(async (tx) => {
        // Create expenses
        await tx.ownerStatementExpense.createMany({
          data: expenses.map((expense) => ({
            ownerStatementId: statement.id,
            date: expense.date ?? defaultDateStr,
            description: input.description,
            vendor: input.vendor,
            amount: expense.amount,
          })),
        })

        // Recalculate totals
        const [incomes, allExpenses, adjustments] = await Promise.all([
          tx.ownerStatementIncome.findMany({
            where: { ownerStatementId: statement.id },
          }),
          tx.ownerStatementExpense.findMany({
            where: { ownerStatementId: statement.id },
          }),
          tx.ownerStatementAdjustment.findMany({
            where: { ownerStatementId: statement.id },
          }),
        ])

        const totalIncome = incomes.reduce(
          (sum, i) => sum + Number(i.grossIncome),
          0
        )
        const totalExpenses = allExpenses.reduce(
          (sum, e) => sum + Number(e.amount),
          0
        )
        const totalAdjustments = adjustments.reduce(
          (sum, a) => sum + Number(a.amount),
          0
        )

        await tx.ownerStatement.update({
          where: { id: statement.id },
          data: {
            totalIncome,
            totalExpenses,
            totalAdjustments,
            grandTotal: totalIncome - totalExpenses + totalAdjustments,
            updatedBy: input.userId,
          },
        })
      })

      updatedProperties.push(propertyName)
      processedCount++
    }

    // Store success result
    jobResults.set(input.jobId, {
      status: 'completed',
      result: {
        updatedCount: processedCount,
        updatedProperties,
        message: `Updated ${processedCount} properties`,
      },
    })

    return Response.json({ success: true })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    // Store error result
    const jobId = JSON.parse(await request.text()).jobId
    if (jobId) {
      jobResults.set(jobId, {
        status: 'failed',
        error: errorMessage,
      })
    }

    console.error('Processing error:', error)
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// Export job results for status endpoint
export { jobResults }
