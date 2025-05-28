import { auth } from '@clerk/nextjs/server'
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { geminiFlashModel } from '~/lib/gemini/gemini'
import { parseJsonField } from '~/lib/utils/json'
import { tryCatch } from '~/lib/utils/try-catch'
import { db } from '~/server/db'

const inputSchema = z.object({
  currentStatementId: z.string(),
  vendor: z.string(),
  description: z.string(),
  pdfBase64: z.string(),
})

// Store processing sessions in memory (in production, use Redis or similar)
const processingSessions = new Map<
  string,
  {
    status: 'processing' | 'completed' | 'error'
    progress?: any
    result?: any
    error?: string
  }
>()

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.orgId || !session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await request.json()
    const input = inputSchema.parse(body)

    // Create a unique session ID
    const sessionId = `${session.orgId}-${Date.now()}`

    // Initialize session
    processingSessions.set(sessionId, { status: 'processing' })

    // Start processing in the background
    processVendorExpenses(
      input,
      session.orgId,
      session.userId,
      sessionId
    ).catch((error) => {
      processingSessions.set(sessionId, {
        status: 'error',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      })
    })

    return Response.json({ sessionId })
  } catch (error) {
    return new Response('Invalid request', { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.orgId || !session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 })
  }

  // Set up Server-Sent Events
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        const sessionData = processingSessions.get(sessionId)

        if (!sessionData) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: 'Session not found' })}\n\n`
            )
          )
          controller.close()
          clearInterval(interval)
          return
        }

        if (sessionData.status === 'processing' && sessionData.progress) {
          controller.enqueue(
            encoder.encode(
              `event: progress\ndata: ${JSON.stringify(sessionData.progress)}\n\n`
            )
          )
        } else if (sessionData.status === 'completed' && sessionData.result) {
          controller.enqueue(
            encoder.encode(
              `event: complete\ndata: ${JSON.stringify(sessionData.result)}\n\n`
            )
          )
          controller.close()
          clearInterval(interval)
          // Clean up session after completion
          setTimeout(() => processingSessions.delete(sessionId), 5000)
        } else if (sessionData.status === 'error') {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: sessionData.error })}\n\n`
            )
          )
          controller.close()
          clearInterval(interval)
          // Clean up session after error
          setTimeout(() => processingSessions.delete(sessionId), 5000)
        }
      }, 1000) // Poll every second

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}

async function processVendorExpenses(
  input: z.infer<typeof inputSchema>,
  orgId: string,
  userId: string,
  sessionId: string
) {
  const updateSession = (progress: any) => {
    const current = processingSessions.get(sessionId)
    if (current) {
      processingSessions.set(sessionId, {
        ...current,
        progress,
      })
    }
  }

  try {
    updateSession({
      step: 'validating',
      message: 'Validating statement...',
    })

    // Get current statement
    const current = await db.ownerStatement.findUnique({
      where: { id: input.currentStatementId },
      select: { statementMonth: true, managementGroupId: true },
    })

    if (!current || current.managementGroupId !== orgId) {
      throw new Error('Statement not found')
    }

    updateSession({
      step: 'fetching',
      message: 'Fetching month statements...',
    })

    // Get all statements for this month
    const monthStatements = await db.ownerStatement.findMany({
      where: {
        managementGroupId: orgId,
        statementMonth: current.statementMonth,
        deletedAt: null,
      },
      select: {
        id: true,
        propertyId: true,
        property: { select: { name: true } },
      },
    })

    updateSession({
      step: 'checking',
      message: `Checking for existing expenses across ${monthStatements.length} properties...`,
    })

    // Check for existing vendor expenses
    const existingVendorExpenses = await db.ownerStatementExpense.findMany({
      where: {
        ownerStatementId: { in: monthStatements.map((s) => s.id) },
        vendor: input.vendor,
        description: input.description,
      },
      select: {
        ownerStatementId: true,
        ownerStatement: {
          select: { property: { select: { name: true } } },
        },
      },
    })

    if (existingVendorExpenses.length > 0) {
      const affectedProperties = existingVendorExpenses
        .map((exp) => exp.ownerStatement.property?.name || 'Unknown Property')
        .filter((name, index, arr) => arr.indexOf(name) === index)

      throw new Error(
        `Vendor "${input.vendor}" with description "${input.description}" already has expenses for this month in ${affectedProperties.length} properties: ${affectedProperties.slice(0, 3).join(', ')}${affectedProperties.length > 3 ? ` and ${affectedProperties.length - 3} more` : ''}`
      )
    }

    updateSession({
      step: 'ai-processing',
      message: 'Processing invoice with AI...',
    })

    // AI Processing (outside any transaction)
    const propertyNames = monthStatements
      .map((s) => s.property?.name)
      .filter((name): name is string => !!name)

    const prompt = `You are an expert data extraction assistant specializing in property management invoices.
You will receive a PDF invoice file. Invoices can vary significantly in format, including tables, lists, or less structured text.
You will also receive a list of known property names relevant to this invoice context:
KNOWN PROPERTY NAMES:
${propertyNames.map((name) => `- ${name}`).join('\n')}

Your task is to extract expense line items from the PDF and associate them with the correct property from the KNOWN PROPERTY NAMES list.

For each expense line item you can confidently match to a property in the KNOWN list, extract ONLY the following details:
1. "date": The date the expense occurred or was invoiced. Format as YYYY-MM-DD if possible, otherwise use the exact format found. If no date is available, provide an empty string.
2. "amount": The cost of the specific line item as a number, removing any currency symbols.

Format your response STRICTLY as a JSON object where:
- Each key is a property name taken *exactly* from the provided KNOWN PROPERTY NAMES list.
- Each value is an array of expense objects: {"date": "...", "amount": ...}.

Respond ONLY with the raw JSON object.`

    if (!geminiFlashModel) {
      throw new Error('AI service unavailable')
    }

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
      throw new Error('Failed to parse invoice with AI')
    }

    const jsonText = result.data.response?.text() ?? '{}'
    const jsonMatch = /\{.*\}/s.exec(jsonText)
    const extractedJson = jsonMatch ? jsonMatch[0] : '{}'

    const expensesMap = parseJsonField<
      Record<string, Array<{ date?: string; amount: number }>>
    >(extractedJson, { logErrors: true, defaultValue: {} })

    if (!expensesMap || Object.keys(expensesMap).length === 0) {
      throw new Error('No property expenses found in invoice')
    }

    updateSession({
      step: 'processing',
      message: `Found expenses for ${Object.keys(expensesMap).length} properties. Processing in batches...`,
    })

    // Process in smaller chunks to avoid timeout
    const CHUNK_SIZE = 10 // Process 10 properties at a time
    const propertyEntries = Object.entries(expensesMap)
    const chunks = []

    for (let i = 0; i < propertyEntries.length; i += CHUNK_SIZE) {
      chunks.push(propertyEntries.slice(i, i + CHUNK_SIZE))
    }

    let processedCount = 0
    const totalProperties = propertyEntries.length

    // Get default date
    const allParsedDates = Object.values(expensesMap)
      .flat()
      .map((expense) => expense.date)
      .filter(
        (date): date is string =>
          date != null && date !== '' && !isNaN(new Date(date).getTime())
      )

    const defaultDate = getDefaultDateForExpenses(
      current.statementMonth,
      allParsedDates
    )

    // Process each chunk
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]!

      updateSession({
        step: 'database',
        message: `Processing batch ${chunkIndex + 1}/${chunks.length} (${processedCount}/${totalProperties} properties completed)...`,
        progress: Math.round((processedCount / totalProperties) * 100),
      })

      // Process this chunk in a single transaction
      await db.$transaction(
        async (tx) => {
          for (const [propertyName, expenses] of chunk) {
            const statement = monthStatements.find(
              (s) => s.property?.name === propertyName
            )
            if (!statement || expenses.length === 0) continue

            await tx.ownerStatementExpense.createMany({
              data: expenses.map((expense) => {
                let expenseDate = expense.date?.trim()
                if (
                  !expenseDate ||
                  expenseDate === '' ||
                  isNaN(new Date(expenseDate).getTime())
                ) {
                  expenseDate = defaultDate
                }

                return {
                  ownerStatementId: statement.id,
                  date: expenseDate,
                  description: input.description,
                  vendor: input.vendor,
                  amount: expense.amount,
                }
              }),
            })

            // Recalculate totals
            await recalculateStatementTotals(tx, statement.id, userId)
            processedCount++
          }
        },
        { timeout: 15000 }
      )
    }

    // Mark as completed
    processingSessions.set(sessionId, {
      status: 'completed',
      result: {
        message: `Successfully processed expenses for ${processedCount} properties`,
        updatedCount: processedCount,
        updatedProperties: Object.keys(expensesMap),
      },
    })
  } catch (error) {
    processingSessions.set(sessionId, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  }
}

function getDefaultDateForExpenses(
  statementMonth: Date,
  existingDates: string[]
): string {
  if (existingDates.length > 0) {
    const validDates = existingDates
      .map((dateStr) => new Date(dateStr))
      .filter((date) => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    if (validDates.length > 0) {
      const medianIndex = Math.floor(validDates.length / 2)
      return validDates[medianIndex]!.toISOString().split('T')[0]!
    }
  }

  const defaultDate = new Date(statementMonth)
  defaultDate.setUTCDate(15)
  return defaultDate.toISOString().split('T')[0]!
}

async function recalculateStatementTotals(
  tx: any,
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

  const totalIncome = incomes.reduce(
    (sum: number, i: any) => sum + Number(i.grossIncome),
    0
  )
  const totalExpenses = expenses.reduce(
    (sum: number, e: any) => sum + Number(e.amount),
    0
  )
  const totalAdjustments = adjustments.reduce(
    (sum: number, a: any) => sum + Number(a.amount),
    0
  )

  const totals = {
    totalIncome: parseFloat(totalIncome.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    totalAdjustments: parseFloat(totalAdjustments.toFixed(2)),
    grandTotal: parseFloat(
      (totalIncome - totalExpenses + totalAdjustments).toFixed(2)
    ),
  }

  return tx.ownerStatement.update({
    where: { id: statementId },
    data: {
      ...totals,
      updatedAt: new Date(),
      updatedBy: userId,
    },
  })
}
