import { auth } from '@clerk/nextjs/server'
import { type Prisma } from '@prisma/client'
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { VendorCache } from '~/lib/OwnerStatement/vendor-cache'
import type {
  MatchedPropertyPreview,
  UnmatchedPropertyPreview,
  VendorImportPreviewResponse,
} from '~/lib/OwnerStatement/vendor-import'
import { matchPropertiesWithGPT } from '~/lib/ai/ai'
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

export async function POST(request: NextRequest): Promise<Response> {
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

    // Use caching for better performance
    const monthKey = `${current.statementMonth.getUTCFullYear()}-${String(current.statementMonth.getUTCMonth() + 1).padStart(2, '0')}`

    // Check cached existing expenses first
    const cachedExists = await VendorCache.getExistingExpenses(
      session.orgId,
      monthKey,
      input.vendor,
      input.description
    )

    let existingExpense = null
    if (cachedExists === null) {
      // Not in cache, check database
      existingExpense = await db.ownerStatementExpense.findFirst({
        where: {
          ownerStatement: {
            managementGroupId: session.orgId,
            statementMonth: current.statementMonth,
          },
          vendor: input.vendor,
          description: input.description,
        },
        select: { id: true },
      })

      // Cache the result
      await VendorCache.setExistingExpenses(
        session.orgId,
        monthKey,
        input.vendor,
        input.description,
        !!existingExpense
      )
    } else if (cachedExists) {
      // Cached result shows it exists
      existingExpense = { id: 'cached' }
    }

    if (existingExpense) {
      throw new Error(
        `Vendor "${input.vendor}" with description "${input.description}" already has expenses for this month`
      )
    }

    // Get cached month properties
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
          property: {
            select: {
              id: true,
              name: true,
              locationInfo: true,
            },
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

    // AI Processing
    if (!geminiFlashModel) {
      throw new Error('AI service unavailable')
    }

    // Prepare property data for GPT matching (includes names and addresses)
    const databaseProperties = monthStatements
      .map((s: any) => s.property)
      .filter(Boolean)
      .map((property: any) => ({
        id: property.id,
        name: property.name,
        address:
          (property.locationInfo as { address?: string } | null)?.address ??
          null,
      }))

    const propertyNames = databaseProperties.map((p) => p.name)

    const prompt = `You are an expert data extraction assistant specializing in property management invoices.
You will receive a PDF invoice file. Invoices can vary significantly in format, including tables, lists, or less structured text.
You will also receive a list of known properties relevant to this invoice context:

KNOWN PROPERTIES:
${databaseProperties
  .map(
    (prop) =>
      `- Name: "${prop.name}"${prop.address ? ` | Address: "${prop.address}"` : ''}`
  )
  .join('\n')}

Your task is to extract expense line items from the PDF and associate them with the correct property from the KNOWN PROPERTIES list.

For each expense line item you can confidently match to a property in the KNOWN list, extract ONLY the following details:
1.  "date": The date the expense occurred or was invoiced. Look for columns labeled 'Date', 'Service Date', or similar. Format as YYYY-MM-DD if possible, otherwise use the exact format found. If no date is available for a line item, you may omit the "date" field or provide an empty string.
2.  "amount": The cost of the specific line item. Look for columns labeled 'Amount', 'Cost', 'Price', 'Total', or similar. Provide this as a number, removing any currency symbols ($, £, etc.).

Crucially:
-   Identify the property associated with each expense. The property name or address might be in a dedicated column ('Property', 'Address', 'Location'), listed near the line item(s), or mentioned as a header for a section.
-   Match the identified property name/address from the invoice to the *closest* property in the provided KNOWN PROPERTIES list using either the name OR address.
-   The output JSON keys MUST be exact matches of the property NAMES from the KNOWN PROPERTIES list.

Format your response STRICTLY as a JSON object where:
- Each key is a property name taken *exactly* from the provided KNOWN PROPERTIES list.
- Each value is an array of expense objects for that property, containing ONLY the extracted "date" and "amount": {"date": "...", "amount": ...}.

Example Output (assuming "Sunset Villa" and "Ocean View Condo" were in the known list):
{
  "Sunset Villa": [{"date": "2024-05-15", "amount": 120.00}],
  "Ocean View Condo": [{"date": "2024-05-10", "amount": 350.50}, {"date": "", "amount": 85.00}]
}

Note: If a date is missing or unclear, you may provide an empty string for the "date" field, and the system will automatically assign an appropriate date.

Important Considerations:
-   Some invoices might list multiple expenses under a single property header. Group these correctly.
-   Some invoices might have line items that don't clearly belong to any property or don't match any property in the KNOWN PROPERTIES list. OMIT these line items entirely from your output.
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

    // Use cached GPT matching for better performance
    const extractedPropertyNames = Object.keys(expensesMap).map((name) =>
      name.trim()
    )

    let gptMatchResult
    try {
      // Try cache first
      gptMatchResult = await VendorCache.getGPTMappings(
        extractedPropertyNames,
        databaseProperties
      )

      if (!gptMatchResult) {
        // Not in cache, call GPT
        gptMatchResult = await matchPropertiesWithGPT({
          importProperties: extractedPropertyNames,
          databaseProperties: databaseProperties.map((p) => ({
            id: p.id,
            name: p.name.trim(),
            address: p.address,
          })),
        })

        // Cache the result
        await VendorCache.setGPTMappings(
          extractedPropertyNames,
          databaseProperties,
          gptMatchResult
        )
      }
    } catch (error) {
      console.error('GPT matching failed:', error)
      throw new Error('Property matching service failed. Please try again.')
    }

    // Process all expenses for preview
    const defaultDate = new Date(current.statementMonth)
    defaultDate.setUTCDate(15)
    const defaultDateStr = defaultDate.toISOString().split('T')[0]!

    // Prepare preview data
    const matched: MatchedPropertyPreview[] = []
    const unmatched: UnmatchedPropertyPreview[] = []

    for (const [extractedPropertyName, extractedExpenses] of Object.entries(
      expensesMap
    )) {
      // Check if GPT matched this property (using trimmed name for lookup)
      const trimmedPropertyName = extractedPropertyName.trim()
      const match = gptMatchResult.matches[trimmedPropertyName]

      const expenses = extractedExpenses.map((exp) => ({
        date: exp.date ?? defaultDateStr,
        description: input.description,
        vendor: input.vendor,
        amount: exp.amount,
      }))

      if (match) {
        // Property was matched
        const dbProperty = databaseProperties.find(
          (p) => p.id === match.propertyId
        )
        if (dbProperty && expenses.length > 0) {
          const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0)

          matched.push({
            property: {
              id: dbProperty.id,
              name: dbProperty.name,
              address: dbProperty.address,
            },
            confidence: match.confidence,
            reason: match.reason,
            expenses,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
          })
        }
      } else {
        // Property was not matched
        if (expenses.length > 0) {
          const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0)

          unmatched.push({
            propertyName: trimmedPropertyName,
            expenses,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
          })
        }
      }
    }

    // Calculate summary
    const totalMatchedProperties = matched.length
    const totalUnmatchedProperties = unmatched.length
    const totalMatchedExpenses = matched.reduce(
      (sum, m) => sum + m.expenses.length,
      0
    )
    const totalUnmatchedExpenses = unmatched.reduce(
      (sum, u) => sum + u.expenses.length,
      0
    )
    const totalMatchedAmount = matched.reduce(
      (sum, m) => sum + m.totalAmount,
      0
    )
    const totalUnmatchedAmount = unmatched.reduce(
      (sum, u) => sum + u.totalAmount,
      0
    )

    const previewResponse: VendorImportPreviewResponse = {
      success: true,
      preview: {
        matched,
        unmatched,
        summary: {
          totalMatchedProperties,
          totalUnmatchedProperties,
          totalMatchedExpenses,
          totalUnmatchedExpenses,
          totalMatchedAmount: parseFloat(totalMatchedAmount.toFixed(2)),
          totalUnmatchedAmount: parseFloat(totalUnmatchedAmount.toFixed(2)),
        },
      },
    }

    return Response.json(previewResponse)
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
