import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { geminiFlashModel } from '~/lib/gemini/gemini'
import { parseJsonField } from '~/lib/utils/json'
import { tryCatch } from '~/lib/utils/try-catch'

import { createTRPCRouter, protectedProcedure } from '../trpc'

// Define the expected structure Gemini should return per item
const ExtractedExpenseItemSchema = z.object({
  date: z.string(), // Keep as string for now
  amount: z.number(),
})
type ExtractedExpenseItemType = z.infer<typeof ExtractedExpenseItemSchema>

// Define the expected map structure { propertyName: [ExtractedItem, ...] }
const ExtractedExpensesMapSchema = z.record(
  z.string(),
  z.array(ExtractedExpenseItemSchema)
)
type ExtractedExpensesMapType = z.infer<typeof ExtractedExpensesMapSchema>

export const ownerStatementRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().optional(),
        month: z.string().optional(), // YYYY-MM
      })
    )
    .query(async ({ ctx, input }) => {
      const { propertyId, month } = input
      const { orgId } = ctx.auth
      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      // Build where clause
      const where: any = {
        managementGroupId: orgId,
        deletedAt: null,
      }
      if (propertyId) where.propertyId = propertyId
      if (month) {
        // Parse YYYY-MM to first/last day of month
        const [year, m] = month.split('-')
        const start = new Date(Number(year), Number(m) - 1, 1)
        const end = new Date(Number(year), Number(m), 0, 23, 59, 59, 999)
        where.statementMonth = {
          gte: start,
          lte: end,
        }
      }

      return ctx.db.ownerStatement.findMany({
        where,
        include: {
          property: true,
        },
        orderBy: [{ statementMonth: 'desc' }],
      })
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        statementMonth: z.date(),
        notes: z.string().optional(),
        incomes: z.array(
          z.object({
            checkIn: z.string(),
            checkOut: z.string(),
            days: z.number(),
            platform: z.string(),
            guest: z.string(),
            grossRevenue: z.number(),
            hostFee: z.number(),
            platformFee: z.number(),
            grossIncome: z.number(),
          })
        ),
        expenses: z
          .array(
            z.object({
              date: z.string(),
              description: z.string(),
              vendor: z.string(),
              amount: z.number(),
            })
          )
          .optional(),
        adjustments: z
          .array(
            z.object({
              checkIn: z.string().optional(),
              checkOut: z.string().optional(),
              description: z.string(),
              amount: z.number(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth
      if (!orgId || !userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization/user',
        })
      }
      return ctx.db.$transaction(async (tx) => {
        const ownerStatement = await tx.ownerStatement.create({
          data: {
            managementGroupId: orgId,
            propertyId: input.propertyId,
            statementMonth: input.statementMonth,
            notes: input.notes,
            createdBy: userId,
            updatedBy: userId,
            incomes: {
              create: input.incomes.map((i) => ({
                checkIn: new Date(i.checkIn),
                checkOut: new Date(i.checkOut),
                days: i.days,
                platform: i.platform,
                guest: i.guest,
                grossRevenue: i.grossRevenue,
                hostFee: i.hostFee,
                platformFee: i.platformFee,
                grossIncome: i.grossIncome,
              })),
            },
            expenses: {
              create: (input.expenses ?? []).map((e) => ({
                date: new Date(e.date),
                description: e.description,
                vendor: e.vendor,
                amount: e.amount,
              })),
            },
            adjustments: {
              create: (input.adjustments ?? []).map((a) => ({
                checkIn: a.checkIn ? new Date(a.checkIn) : undefined,
                checkOut: a.checkOut ? new Date(a.checkOut) : undefined,
                description: a.description,
                amount: a.amount,
              })),
            },
          },
          include: {
            incomes: true,
            expenses: true,
            adjustments: true,
            property: true,
          },
        })
        return ownerStatement
      })
    }),

  parseInvoiceExpenseWithGemini: protectedProcedure
    .input(
      z.object({
        pdfBase64: z.string(),
        draftPropertyNames: z.array(z.string()),
        vendor: z.string().min(1, 'Vendor is required'),
        description: z.string().min(1, 'Description is required'),
      })
    )
    .mutation(async ({ input }) => {
      if (!geminiFlashModel) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Gemini model not initialized. Check API key.',
        })
      }

      const { pdfBase64, draftPropertyNames, vendor, description } = input

      // Construct the prompt for Gemini
      const prompt = `
You are an expert data extraction assistant for property management invoices.
You will receive a PDF invoice file which may list expenses for one or multiple properties.
You will also receive a list of known property names currently being reviewed:
KNOWN PROPERTY NAMES:
${draftPropertyNames.map((name) => `- ${name}`).join('\n')}

Your goal is ONLY to extract the DATE and AMOUNT for expense line items found in the PDF and group them by the property they are associated with.
Crucially, for each group of expenses, the key in the output JSON MUST be one of the names from the KNOWN PROPERTY NAMES list provided above. Find the closest match from the known list for the property mentioned in the invoice text.

For each matched property from the known list, extract ONLY the following details for each expense:
1.  "date": The date of the expense (format as YYYY-MM-DD if possible, otherwise use the format found).
2.  "amount": The expense amount (as a number, no currency symbols).

Format your response STRICTLY as a JSON object where:
- Each key is a property name exactly from the provided KNOWN PROPERTY NAMES list.
- Each value is an array of expense objects for that property, containing ONLY date and amount: {"date": "...", "amount": ...}.

Example Output (assuming "123 Main St" and "456 Oak Ave Apt B" were in the known list):
{
  "123 Main St": [{"date": "2024-05-15", "amount": 120.00}],
  "456 Oak Ave Apt B": [{"date": "2024-05-10", "amount": 350.50}, {"date": "2024-05-18", "amount": 85.00}]
}

If an expense in the invoice cannot be confidently matched to any property in the KNOWN PROPERTY NAMES list, OMIT that expense entirely from the output.
If no expenses can be matched to any known property, return an empty JSON object {}.
Respond ONLY with the JSON object. Do not include explanations, apologies, or markdown formatting.
      `

      const pdfPart = {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      }

      const generationResult = await tryCatch(
        geminiFlashModel.generateContent([prompt, pdfPart])
      )

      if (generationResult.error) {
        console.error(
          'Gemini content generation error object:',
          generationResult.error
        )
      } else {
        console.log('Gemini generation successful (raw response pending).')
      }

      if (generationResult.error) {
        console.error(
          'Gemini content generation failed:',
          generationResult.error
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AI failed to generate content from invoice.',
          cause: generationResult.error,
        })
      }

      const response = await generationResult.data.response
      const jsonText = response?.text() ?? '{}'

      const jsonMatch = jsonText.match(/\{.*\}/s)
      const extractedJson = jsonMatch ? jsonMatch[0] : '{}'

      console.log('Raw text response from Gemini:', jsonText)
      console.log('Extracted text for parsing:', extractedJson)

      const parsedExpensesMap = parseJsonField<ExtractedExpensesMapType>(
        extractedJson,
        {
          logErrors: true,
          // validate: (value): value is ExtractedExpensesMapType =>
          //   ExtractedExpensesMapSchema.safeParse(value).success,
          defaultValue: {}, // Default to empty object
        }
      )

      console.log(
        'Parsed expenses map after parseJsonField:',
        parsedExpensesMap
      )

      if (parsedExpensesMap === null) {
        console.error(
          'parseJsonField returned null unexpectedly despite defaultValue being set.'
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process AI response.',
        })
      }

      if (Object.keys(parsedExpensesMap).length === 0) {
        console.log('No property expenses could be extracted from the invoice.')
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'AI could not extract any property expenses from the invoice.',
        })
      }

      return parsedExpensesMap
    }),
})
