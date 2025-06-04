import { auth } from '@clerk/nextjs/server'
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

    const prompt = `You are an expert data extraction assistant specializing in property management invoices.
You will receive a PDF invoice file. Invoices can vary significantly in format, including tables, lists, or less structured text.
You will also receive a list of known property names relevant to this invoice context:
KNOWN PROPERTY NAMES:
${propertyNames.map((name) => `- ${name}`).join('\n')}

Your task is to extract expense line items from the PDF and associate them with the correct property from the KNOWN PROPERTY NAMES list.

For each expense line item you can confidently match to a property in the KNOWN list, extract ONLY the following details:
1.  "date": The date the expense occurred or was invoiced. Look for columns labeled 'Date', 'Service Date', or similar. Format as YYYY-MM-DD if possible, otherwise use the exact format found. If no date is available for a line item, you may omit the "date" field or provide an empty string.
2.  "amount": The cost of the specific line item. Look for columns labeled 'Amount', 'Cost', 'Price', 'Total', or similar. Provide this as a number, removing any currency symbols ($, £, etc.).

Crucially:
-   Identify the property associated with each expense. The property name or address might be in a dedicated column ('Property', 'Address', 'Location'), listed near the line item(s), or mentioned as a header for a section.
-   Match the identified property name/address from the invoice to the *closest* name in the provided KNOWN PROPERTY NAMES list.
-   The output JSON keys MUST be exact matches from the KNOWN PROPERTY NAMES list.

Format your response STRICTLY as a JSON object where:
- Each key is a property name taken *exactly* from the provided KNOWN PROPERTY NAMES list.
- Each value is an array of expense objects for that property, containing ONLY the extracted "date" and "amount": {"date": "...", "amount": ...}.

Example Output (assuming "123 Main St" and "456 Oak Ave Apt B" were in the known list):
{
  "123 Main St": [{"date": "2024-05-15", "amount": 120.00}],
  "456 Oak Ave Apt B": [{"date": "2024-05-10", "amount": 350.50}, {"date": "", "amount": 85.00}]
}

Note: If a date is missing or unclear, you may provide an empty string for the "date" field, and the system will automatically assign an appropriate date.

Important Considerations:
-   Some invoices might list multiple expenses under a single property header. Group these correctly.
-   Some invoices might have line items that don't clearly belong to any property or don't match any name in the KNOWN PROPERTY NAMES list. OMIT these line items entirely from your output.
-   If no expense line items can be successfully extracted and matched to any property in the KNOWN list, return an empty JSON object {}.
-   Focus solely on extracting the requested 'date' and 'amount' per matched property. Do not extract descriptions, vendors, or other details into the JSON output.
-   Respond ONLY with the raw JSON object. Do not include explanations, apologies, markdown formatting, or any text outside the JSON structure.`

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

    for (const [propertyName, expenses] of Object.entries(expensesMap)) {
      const statement = monthStatements.find(
        (s) => s.property?.name === propertyName
      )

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

    // Optimization 1: Remove timeout entirely - let Prisma use default
    // Optimization 2: Break into smaller chunks - process in batches
    // Optimization 3: Optimize aggregation queries - use more efficient bulk operations

    // First, create all expenses in one efficient operation
    await db.ownerStatementExpense.createMany({
      data: allExpenseData,
    })

    // Process statement updates in batches to avoid timeout
    const statementIds = Array.from(statementsToUpdate)
    const BATCH_SIZE = 5 // Process 5 statements at a time

    for (let i = 0; i < statementIds.length; i += BATCH_SIZE) {
      const batch = statementIds.slice(i, i + BATCH_SIZE)

      // Use optimized parallel processing for each batch
      await Promise.all(
        batch.map(async (statementId) => {
          // Single optimized query to get all totals at once using raw SQL for better performance
          const totals = await db.$queryRaw<
            Array<{
              totalIncome: number
              totalExpenses: number
              totalAdjustments: number
            }>
          >`
            SELECT 
              COALESCE(SUM(CASE WHEN income.id IS NOT NULL THEN income.grossIncome ELSE 0 END), 0) as totalIncome,
              COALESCE(SUM(CASE WHEN expense.id IS NOT NULL THEN expense.amount ELSE 0 END), 0) as totalExpenses,
              COALESCE(SUM(CASE WHEN adjustment.id IS NOT NULL THEN adjustment.amount ELSE 0 END), 0) as totalAdjustments
            FROM OwnerStatement stmt
            LEFT JOIN OwnerStatementIncome income ON income.ownerStatementId = stmt.id
            LEFT JOIN OwnerStatementExpense expense ON expense.ownerStatementId = stmt.id  
            LEFT JOIN OwnerStatementAdjustment adjustment ON adjustment.ownerStatementId = stmt.id
            WHERE stmt.id = ${statementId}
            GROUP BY stmt.id
          `

          const result = totals[0]
          if (!result) return

          const totalIncome = Number(result.totalIncome)
          const totalExpenses = Number(result.totalExpenses)
          const totalAdjustments = Number(result.totalAdjustments)

          // Update statement with calculated totals
          await db.ownerStatement.update({
            where: { id: statementId },
            data: {
              totalIncome,
              totalExpenses,
              totalAdjustments,
              grandTotal: totalIncome - totalExpenses + totalAdjustments,
              updatedBy: session.userId,
            },
          })
        })
      )
    }

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
