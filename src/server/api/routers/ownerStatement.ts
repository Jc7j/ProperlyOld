import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { geminiFlashModel } from '~/lib/gemini/gemini'
import { parseJsonField } from '~/lib/utils/json'
import { tryCatch } from '~/lib/utils/try-catch'

import { createTRPCRouter, protectedProcedure } from '../trpc'

const incomeSchema = z.object({
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

const expenseSchema = z.object({
  date: z.string(),
  description: z.string(),
  vendor: z.string(),
  amount: z.number(),
})

const adjustmentSchema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  description: z.string(),
  amount: z.number(),
})

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

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { orgId } = ctx.auth
      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const statement = await ctx.db.ownerStatement.findUnique({
        where: { id: input.id },
        include: {
          property: true, // Include property details
          incomes: true, // Include all incomes
          expenses: true, // Include all expenses
          adjustments: true, // Include all adjustments
        },
      })

      if (!statement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Owner Statement with ID ${input.id} not found.`,
        })
      }

      // Authorization check
      if (statement.managementGroupId !== orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this statement.',
        })
      }

      return statement
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
        totalIncome: z.number(),
        totalExpenses: z.number(),
        totalAdjustments: z.number(),
        grandTotal: z.number(),
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
        const managementGroup = await tx.managementGroup.findUnique({
          where: { id: orgId },
          select: { id: true }, // Only select id, we just need to know it exists
        })

        if (!managementGroup) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid Management Group ID: ${orgId}. Cannot create statement.`,
          })
        }

        // Validate summary calculations
        const expectedTotalIncome = input.incomes.reduce(
          (sum, i) => sum + (i.grossIncome || 0),
          0
        )

        const expectedTotalExpenses = (input.expenses ?? []).reduce(
          (sum, e) => sum + (e.amount || 0),
          0
        )

        const expectedTotalAdjustments = (input.adjustments ?? []).reduce(
          (sum, a) => sum + (a.amount || 0),
          0
        )

        const expectedGrandTotal =
          expectedTotalIncome - expectedTotalExpenses + expectedTotalAdjustments

        // Verify totals match calculations (within small rounding tolerance)
        const isClose = (a: number, b: number) => Math.abs(a - b) < 0.01

        if (!isClose(input.totalIncome, expectedTotalIncome)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Total income (${input.totalIncome}) doesn't match calculated total (${expectedTotalIncome})`,
          })
        }

        if (!isClose(input.totalExpenses, expectedTotalExpenses)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Total expenses (${input.totalExpenses}) doesn't match calculated total (${expectedTotalExpenses})`,
          })
        }

        if (!isClose(input.totalAdjustments, expectedTotalAdjustments)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Total adjustments (${input.totalAdjustments}) doesn't match calculated total (${expectedTotalAdjustments})`,
          })
        }

        if (!isClose(input.grandTotal, expectedGrandTotal)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Grand total (${input.grandTotal}) doesn't match calculated total (${expectedGrandTotal})`,
          })
        }

        const ownerStatement = await tx.ownerStatement.create({
          data: {
            managementGroupId: orgId, // Use the verified orgId
            propertyId: input.propertyId,
            statementMonth: input.statementMonth,
            notes: input.notes,
            createdBy: userId,
            updatedBy: userId,
            // Include summary fields
            totalIncome: input.totalIncome,
            totalExpenses: input.totalExpenses,
            totalAdjustments: input.totalAdjustments,
            grandTotal: input.grandTotal,
            incomes: {
              create: input.incomes.map((i) => ({
                checkIn: i.checkIn,
                checkOut: i.checkOut,
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
                date: e.date,
                description: e.description,
                vendor: e.vendor,
                amount: e.amount,
              })),
            },
            adjustments: {
              create: (input.adjustments ?? []).map((a) => ({
                checkIn: a.checkIn,
                checkOut: a.checkOut,
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

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().optional(),
        incomes: z.array(incomeSchema),
        expenses: z.array(expenseSchema).optional(),
        adjustments: z.array(adjustmentSchema).optional(),
        totalIncome: z.number(),
        totalExpenses: z.number(),
        totalAdjustments: z.number(),
        grandTotal: z.number(),
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

      const {
        id,
        notes,
        incomes,
        expenses,
        adjustments,
        totalIncome,
        totalExpenses,
        totalAdjustments,
        grandTotal,
      } = input

      return ctx.db.$transaction(async (tx) => {
        const existingStatement = await tx.ownerStatement.findUnique({
          where: { id: id },
          select: { managementGroupId: true },
        })

        if (!existingStatement) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Owner Statement with ID ${id} not found.`,
          })
        }

        if (existingStatement.managementGroupId !== orgId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to update this statement.',
          })
        }

        // Validate summary calculations
        const expectedTotalIncome = incomes.reduce(
          (sum, i) => sum + (i.grossIncome || 0),
          0
        )

        const expectedTotalExpenses = (expenses ?? []).reduce(
          (sum, e) => sum + (e.amount || 0),
          0
        )

        const expectedTotalAdjustments = (adjustments ?? []).reduce(
          (sum, a) => sum + (a.amount || 0),
          0
        )

        const expectedGrandTotal =
          expectedTotalIncome - expectedTotalExpenses + expectedTotalAdjustments

        // Verify totals match calculations (within small rounding tolerance)
        const isClose = (a: number, b: number) => Math.abs(a - b) < 0.01

        if (!isClose(totalIncome, expectedTotalIncome)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Total income (${totalIncome}) doesn't match calculated total (${expectedTotalIncome})`,
          })
        }

        if (!isClose(totalExpenses, expectedTotalExpenses)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Total expenses (${totalExpenses}) doesn't match calculated total (${expectedTotalExpenses})`,
          })
        }

        if (!isClose(totalAdjustments, expectedTotalAdjustments)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Total adjustments (${totalAdjustments}) doesn't match calculated total (${expectedTotalAdjustments})`,
          })
        }

        if (!isClose(grandTotal, expectedGrandTotal)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Grand total (${grandTotal}) doesn't match calculated total (${expectedGrandTotal})`,
          })
        }

        // 2. Delete existing nested items
        await tx.ownerStatementIncome.deleteMany({
          where: { ownerStatementId: id },
        })
        await tx.ownerStatementExpense.deleteMany({
          where: { ownerStatementId: id },
        })
        await tx.ownerStatementAdjustment.deleteMany({
          where: { ownerStatementId: id },
        })

        // 3. Update the main OwnerStatement record
        const updatedStatement = await tx.ownerStatement.update({
          where: { id: id },
          data: {
            notes: notes, // Update notes
            updatedBy: userId, // Update timestamp/user
            // Update summary totals
            totalIncome: totalIncome,
            totalExpenses: totalExpenses,
            totalAdjustments: totalAdjustments,
            grandTotal: grandTotal,
            // Re-create nested items:
            incomes: {
              create: incomes.map((i) => ({ ...i })),
            },
            expenses: {
              create: (expenses ?? []).map((e) => ({ ...e })),
            },
            adjustments: {
              create: (adjustments ?? []).map((a) => ({ ...a })),
            },
          },
          include: {
            // Include relations needed by the frontend after update
            incomes: true,
            expenses: true,
            adjustments: true,
            property: true,
          },
        })

        return updatedStatement
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

      const { pdfBase64, draftPropertyNames } = input

      // Construct the prompt for Gemini
      const prompt = `You are an expert data extraction assistant specializing in property management invoices.
You will receive a PDF invoice file. Invoices can vary significantly in format, including tables, lists, or less structured text.
You will also receive a list of known property names relevant to this invoice context:
KNOWN PROPERTY NAMES:
${draftPropertyNames.map((name) => `- ${name}`).join('\n')}

Your task is to extract expense line items from the PDF and associate them with the correct property from the KNOWN PROPERTY NAMES list.

For each expense line item you can confidently match to a property in the KNOWN list, extract ONLY the following details:
1.  "date": The date the expense occurred or was invoiced. Look for columns labeled 'Date', 'Service Date', or similar. Format as YYYY-MM-DD if possible, otherwise use the exact format found.
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
  "456 Oak Ave Apt B": [{"date": "2024-05-10", "amount": 350.50}, {"date": "2024-05-18", "amount": 85.00}]
}

Important Considerations:
-   Some invoices might list multiple expenses under a single property header. Group these correctly.
-   Some invoices might have line items that don't clearly belong to any property or don't match any name in the KNOWN PROPERTY NAMES list. OMIT these line items entirely from your output.
-   If no expense line items can be successfully extracted and matched to any property in the KNOWN list, return an empty JSON object {}.
-   Focus solely on extracting the requested 'date' and 'amount' per matched property. Do not extract descriptions, vendors, or other details into the JSON output.
-   Respond ONLY with the raw JSON object. Do not include explanations, apologies, markdown formatting, or any text outside the JSON structure.`

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
          'Gemini content generation failed:',
          generationResult.error
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate content from invoice.',
          cause: generationResult.error,
        })
      }

      const response = generationResult.data.response
      const jsonText = response?.text() ?? '{}'

      const jsonRegex = /\{.*\}/s
      const jsonMatch = jsonRegex.exec(jsonText)
      const extractedJson = jsonMatch ? jsonMatch[0] : '{}'

      const parsedExpensesMap = parseJsonField(extractedJson, {
        logErrors: true,
        defaultValue: {},
      })

      if (parsedExpensesMap === null) {
        console.error(
          'parseJsonField returned null unexpectedly despite defaultValue being set.'
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process response.',
        })
      }

      if (Object.keys(parsedExpensesMap).length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Could not extract any property expenses from the invoice.',
        })
      }

      return parsedExpensesMap
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth
      if (!orgId || !userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization/user',
        })
      }

      return ctx.db.$transaction(async (tx) => {
        // First check if statement exists and user has permission
        const statement = await tx.ownerStatement.findUnique({
          where: { id: input.id },
          select: { managementGroupId: true, deletedAt: true },
        })

        if (!statement) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Owner Statement with ID ${input.id} not found.`,
          })
        }

        if (statement.managementGroupId !== orgId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to delete this statement.',
          })
        }

        if (statement.deletedAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This statement has already been deleted.',
          })
        }

        // Soft delete the statement by updating deletedAt field
        await tx.ownerStatement.update({
          where: { id: input.id },
          data: {
            deletedAt: new Date(),
            updatedBy: userId,
          },
        })

        return { success: true }
      })
    }),
})
