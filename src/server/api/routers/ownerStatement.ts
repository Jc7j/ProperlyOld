import type { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { geminiFlashModel } from '~/lib/gemini/gemini'
import { parseJsonField } from '~/lib/utils/json'
import { tryCatch } from '~/lib/utils/try-catch'

import { createTRPCRouter, protectedProcedure } from '../trpc'

/**
 * Owner Statement Router
 *
 * Performance Optimizations:
 * - AI processing moved outside transactions to reduce transaction time
 * - Batch operations with Promise.all for parallel processing
 * - Optimized for Prisma Accelerate 15-second transaction limit:
 *   - applyMonthlyVendorExpenses: 15s (handles AI + multiple properties)
 *   - importVendorExpensesFromExcel: 15s (chunked for large datasets)
 *   - createMonthlyBatch: 15s (chunked for many statements)
 * - Chunking strategy: 200 expenses per transaction for optimal performance
 */

/**
 * Helper function to chunk arrays for processing within transaction limits
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

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

function calculateTotals(
  incomes: z.infer<typeof incomeSchema>[],
  expenses: z.infer<typeof expenseSchema>[],
  adjustments: z.infer<typeof adjustmentSchema>[]
) {
  const totalIncome = incomes.reduce((sum, i) => sum + (i.grossIncome ?? 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0)
  const totalAdjustments = adjustments.reduce(
    (sum, a) => sum + (a.amount ?? 0),
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

function validateTotals(
  provided: {
    totalIncome: number
    totalExpenses: number
    totalAdjustments: number
    grandTotal: number
  },
  calculated: {
    totalIncome: number
    totalExpenses: number
    totalAdjustments: number
    grandTotal: number
  }
) {
  const tolerance = 0.01
  const isClose = (a: number, b: number) => Math.abs(a - b) < tolerance

  if (!isClose(provided.totalIncome, calculated.totalIncome)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Total income mismatch: provided ${provided.totalIncome}, calculated ${calculated.totalIncome}`,
    })
  }

  if (!isClose(provided.totalExpenses, calculated.totalExpenses)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Total expenses mismatch: provided ${provided.totalExpenses}, calculated ${calculated.totalExpenses}`,
    })
  }

  if (!isClose(provided.totalAdjustments, calculated.totalAdjustments)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Total adjustments mismatch: provided ${provided.totalAdjustments}, calculated ${calculated.totalAdjustments}`,
    })
  }

  if (!isClose(provided.grandTotal, calculated.grandTotal)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Grand total mismatch: provided ${provided.grandTotal}, calculated ${calculated.grandTotal}`,
    })
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

  const totals = calculateTotals(
    incomes.map((i) => ({
      checkIn: i.checkIn,
      checkOut: i.checkOut,
      days: i.days,
      platform: i.platform,
      guest: i.guest,
      grossRevenue: Number(i.grossRevenue),
      hostFee: Number(i.hostFee),
      platformFee: Number(i.platformFee),
      grossIncome: Number(i.grossIncome),
    })),
    expenses.map((e) => ({
      date: e.date,
      description: e.description,
      vendor: e.vendor,
      amount: Number(e.amount),
    })),
    adjustments.map((a) => ({
      checkIn: a.checkIn ?? undefined,
      checkOut: a.checkOut ?? undefined,
      description: a.description,
      amount: Number(a.amount),
    }))
  )

  return tx.ownerStatement.update({
    where: { id: statementId },
    data: {
      ...totals,
      updatedAt: new Date(),
      updatedBy: userId,
    },
    include: {
      property: true,
      incomes: true,
      expenses: true,
      adjustments: true,
    },
  })
}

function getDefaultDateForExpenses(
  statementMonth: Date,
  existingDates: string[]
): string {
  // If we have existing dates, find the most common date or use the median
  if (existingDates.length > 0) {
    const validDates = existingDates
      .map((dateStr) => new Date(dateStr))
      .filter((date) => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    if (validDates.length > 0) {
      // Use the median date if we have multiple dates
      const medianIndex = Math.floor(validDates.length / 2)
      return validDates[medianIndex]!.toISOString().split('T')[0]!
    }
  }

  // Default to the 15th of the statement month
  const defaultDate = new Date(statementMonth)
  defaultDate.setUTCDate(15)
  return defaultDate.toISOString().split('T')[0]!
}

function prepareUpdateData(
  section: 'incomes' | 'expenses' | 'adjustments',
  field: string,
  value: string | number | null
): any {
  if (section === 'incomes') {
    if (['checkIn', 'checkOut', 'platform', 'guest'].includes(field)) {
      if (typeof value !== 'string') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${field} must be a string`,
        })
      }
      return { [field]: value }
    }
    if (field === 'days') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${field} must be an integer`,
        })
      }
      return { [field]: value }
    }
    if (
      ['grossRevenue', 'hostFee', 'platformFee', 'grossIncome'].includes(field)
    ) {
      if (typeof value !== 'number') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${field} must be a number`,
        })
      }
      return { [field]: value }
    }
  }

  if (section === 'expenses') {
    if (['date', 'description', 'vendor'].includes(field)) {
      if (typeof value !== 'string') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${field} must be a string`,
        })
      }
      return { [field]: value }
    }
    if (field === 'amount') {
      if (typeof value !== 'number') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${field} must be a number`,
        })
      }
      return { [field]: value }
    }
  }

  if (section === 'adjustments') {
    if (['checkIn', 'checkOut'].includes(field)) {
      if (value !== null && typeof value !== 'string') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${field} must be a string or null`,
        })
      }
      return { [field]: value }
    }
    if (field === 'description') {
      if (typeof value !== 'string') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${field} must be a string`,
        })
      }
      return { [field]: value }
    }
    if (field === 'amount') {
      if (typeof value !== 'number') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${field} must be a number`,
        })
      }
      return { [field]: value }
    }
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Invalid field ${field} for section ${section}`,
  })
}

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

      let statements = await ctx.db.ownerStatement.findMany({
        where: {
          managementGroupId: orgId,
          deletedAt: null,
          ...(propertyId && { propertyId }),
        },
        include: { property: true },
        orderBy: [{ property: { name: 'asc' } }, { statementMonth: 'desc' }],
      })

      // Filter by month if provided
      if (month) {
        statements = statements.filter((statement) => {
          const statementDate = new Date(statement.statementMonth)
          const statementMonth = `${statementDate.getUTCFullYear()}-${String(statementDate.getUTCMonth() + 1).padStart(2, '0')}`
          return statementMonth === month
        })
      }

      return statements
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
          property: true,
          incomes: true,
          expenses: true,
          adjustments: true,
        },
      })

      if (!statement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Owner statement not found',
        })
      }

      if (statement.managementGroupId !== orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        })
      }

      return statement
    }),

  getManyWithDetails: protectedProcedure
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

      let statements = await ctx.db.ownerStatement.findMany({
        where: {
          managementGroupId: orgId,
          deletedAt: null,
          ...(propertyId && { propertyId }),
        },
        include: {
          property: true,
          incomes: true,
          expenses: true,
          adjustments: true,
        },
        orderBy: [{ property: { name: 'asc' } }, { statementMonth: 'desc' }],
      })

      // Filter by month if provided
      if (month) {
        statements = statements.filter((statement) => {
          const statementDate = new Date(statement.statementMonth)
          const statementMonth = `${statementDate.getUTCFullYear()}-${String(statementDate.getUTCMonth() + 1).padStart(2, '0')}`
          return statementMonth === month
        })
      }

      return statements
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        statementMonth: z.date(),
        notes: z.string().optional(),
        incomes: z.array(incomeSchema),
        expenses: z.array(expenseSchema).optional().default([]),
        adjustments: z.array(adjustmentSchema).optional().default([]),
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
          message: 'Authentication required',
        })
      }

      const calculated = calculateTotals(
        input.incomes,
        input.expenses,
        input.adjustments
      )
      validateTotals(
        {
          totalIncome: input.totalIncome,
          totalExpenses: input.totalExpenses,
          totalAdjustments: input.totalAdjustments,
          grandTotal: input.grandTotal,
        },
        calculated
      )

      return ctx.db.ownerStatement.create({
        data: {
          managementGroupId: orgId,
          propertyId: input.propertyId,
          statementMonth: input.statementMonth,
          notes: input.notes,
          createdBy: userId,
          updatedBy: userId,
          ...calculated,
          incomes: { create: input.incomes },
          expenses: { create: input.expenses },
          adjustments: { create: input.adjustments },
        },
        include: {
          property: true,
          incomes: true,
          expenses: true,
          adjustments: true,
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().optional(),
        incomes: z.array(incomeSchema),
        expenses: z.array(expenseSchema),
        adjustments: z.array(adjustmentSchema),
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
          message: 'Authentication required',
        })
      }

      const calculated = calculateTotals(
        input.incomes,
        input.expenses,
        input.adjustments
      )
      validateTotals(
        {
          totalIncome: input.totalIncome,
          totalExpenses: input.totalExpenses,
          totalAdjustments: input.totalAdjustments,
          grandTotal: input.grandTotal,
        },
        calculated
      )

      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.ownerStatement.findUnique({
          where: { id: input.id },
          select: { managementGroupId: true },
        })

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Owner statement not found',
          })
        }

        if (existing.managementGroupId !== orgId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          })
        }

        // Delete existing nested items
        await Promise.all([
          tx.ownerStatementIncome.deleteMany({
            where: { ownerStatementId: input.id },
          }),
          tx.ownerStatementExpense.deleteMany({
            where: { ownerStatementId: input.id },
          }),
          tx.ownerStatementAdjustment.deleteMany({
            where: { ownerStatementId: input.id },
          }),
        ])

        return tx.ownerStatement.update({
          where: { id: input.id },
          data: {
            notes: input.notes,
            updatedBy: userId,
            ...calculated,
            incomes: { create: input.incomes },
            expenses: { create: input.expenses },
            adjustments: { create: input.adjustments },
          },
          include: {
            property: true,
            incomes: true,
            expenses: true,
            adjustments: true,
          },
        })
      })
    }),

  updateItemField: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        section: z.enum(['incomes', 'expenses', 'adjustments']),
        field: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId || !userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        })
      }

      return ctx.db.$transaction(async (tx) => {
        let item: any
        let statementId: string

        // Get the item and verify ownership
        if (input.section === 'incomes') {
          item = await tx.ownerStatementIncome.findUnique({
            where: { id: input.id },
            include: {
              ownerStatement: { select: { managementGroupId: true, id: true } },
            },
          })
          statementId = item?.ownerStatement.id
        } else if (input.section === 'expenses') {
          item = await tx.ownerStatementExpense.findUnique({
            where: { id: input.id },
            include: {
              ownerStatement: { select: { managementGroupId: true, id: true } },
            },
          })
          statementId = item?.ownerStatement.id
        } else {
          item = await tx.ownerStatementAdjustment.findUnique({
            where: { id: input.id },
            include: {
              ownerStatement: { select: { managementGroupId: true, id: true } },
            },
          })
          statementId = item?.ownerStatement.id
        }

        if (!item) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Item not found',
          })
        }

        if (item.ownerStatement.managementGroupId !== orgId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          })
        }

        const updateData = prepareUpdateData(
          input.section,
          input.field,
          input.value
        )

        // Update the item
        if (input.section === 'incomes') {
          await tx.ownerStatementIncome.update({
            where: { id: input.id },
            data: updateData,
          })
        } else if (input.section === 'expenses') {
          await tx.ownerStatementExpense.update({
            where: { id: input.id },
            data: updateData,
          })
        } else {
          await tx.ownerStatementAdjustment.update({
            where: { id: input.id },
            data: updateData,
          })
        }

        return recalculateStatementTotals(tx, statementId, userId)
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId || !userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        })
      }

      return ctx.db.$transaction(async (tx) => {
        const statement = await tx.ownerStatement.findUnique({
          where: { id: input.id },
          select: { managementGroupId: true, deletedAt: true },
        })

        if (!statement) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Owner statement not found',
          })
        }

        if (statement.managementGroupId !== orgId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          })
        }

        if (statement.deletedAt) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Statement already deleted',
          })
        }

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

  createMonthlyBatch: protectedProcedure
    .input(
      z.object({
        statementMonth: z.date(),
        hostawayData: z
          .array(
            z.object({
              propertyId: z.string(),
              propertyName: z.string(),
              incomes: z.array(incomeSchema),
              expenses: z.array(expenseSchema).optional().default([]),
              adjustments: z.array(adjustmentSchema).optional().default([]),
              notes: z.string().optional(),
            })
          )
          .max(100, 'Cannot create more than 100 statements at once'), // Rate limiting
        skipExisting: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId || !userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        })
      }

      // Validate statement month is not in the future or too far in the past
      const now = new Date()
      const statementMonth = new Date(input.statementMonth)
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1)

      if (statementMonth > now) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create statements for future months',
        })
      }

      if (statementMonth < twoYearsAgo) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create statements for months older than 2 years',
        })
      }

      // Validate that all properties belong to the organization
      const propertyIds = input.hostawayData.map((data) => data.propertyId)
      const validProperties = await ctx.db.property.findMany({
        where: {
          id: { in: propertyIds },
          managementGroupId: orgId,
          deletedAt: null,
        },
        select: { id: true, name: true },
      })

      const validPropertyIds = new Set(validProperties.map((p) => p.id))
      const invalidProperties = input.hostawayData.filter(
        (data) => !validPropertyIds.has(data.propertyId)
      )

      if (invalidProperties.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid properties: ${invalidProperties.map((p) => p.propertyName).join(', ')}`,
        })
      }

      return ctx.db.$transaction(
        async (tx) => {
          let existingCount = 0
          let replacedCount = 0

          if (input.skipExisting) {
            const existing = await tx.ownerStatement.findMany({
              where: {
                managementGroupId: orgId,
                statementMonth: input.statementMonth,
                deletedAt: null,
              },
              select: {
                propertyId: true,
                property: { select: { name: true } },
              },
            })

            existingCount = existing.length
            const existingPropertyIds = new Set(
              existing.map((s) => s.propertyId)
            )
            input.hostawayData = input.hostawayData.filter(
              (data) => !existingPropertyIds.has(data.propertyId)
            )
          } else {
            // If not skipping existing, soft delete all existing statements for this month
            const existingToReplace = await tx.ownerStatement.findMany({
              where: {
                managementGroupId: orgId,
                statementMonth: input.statementMonth,
                deletedAt: null,
              },
              select: { id: true },
            })

            replacedCount = existingToReplace.length

            if (replacedCount > 0) {
              await tx.ownerStatement.updateMany({
                where: {
                  managementGroupId: orgId,
                  statementMonth: input.statementMonth,
                  deletedAt: null,
                },
                data: {
                  deletedAt: new Date(),
                  updatedBy: userId,
                },
              })
            }
          }

          if (input.hostawayData.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: input.skipExisting
                ? `No new statements to create - all ${existingCount} properties already have statements for this month`
                : 'No statements to create',
            })
          }

          const statements = await Promise.all(
            input.hostawayData.map(async (data) => {
              const totals = calculateTotals(
                data.incomes,
                data.expenses,
                data.adjustments
              )

              return tx.ownerStatement.create({
                data: {
                  managementGroupId: orgId,
                  propertyId: data.propertyId,
                  statementMonth: input.statementMonth,
                  notes: data.notes ?? '',
                  createdBy: userId,
                  updatedBy: userId,
                  ...totals,
                  incomes: { create: data.incomes },
                  expenses: { create: data.expenses },
                  adjustments: { create: data.adjustments },
                },
                include: { property: true },
              })
            })
          )

          return {
            createdCount: statements.length,
            existingCount,
            replacedCount,
            firstStatementId: statements[0]?.id,
            createdStatements: statements,
          }
        },
        {
          timeout: 15000, // 15 seconds timeout (Accelerate limit)
        }
      )
    }),

  applyMonthlyVendorExpenses: protectedProcedure
    .input(
      z.object({
        currentStatementId: z.string(),
        vendor: z.string(),
        description: z.string(),
        pdfBase64: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId || !userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        })
      }

      // For large organizations (70+ properties), redirect to streaming API
      const propertyCount = await ctx.db.property.count({
        where: {
          managementGroupId: orgId,
          deletedAt: null,
        },
      })

      if (propertyCount > 50) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'REDIRECT_TO_STREAMING',
          cause: {
            propertyCount,
            message:
              'Large organization detected. Please use the streaming API for better performance.',
          },
        })
      }

      if (!geminiFlashModel) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'AI service unavailable',
        })
      }

      const current = await ctx.db.ownerStatement.findUnique({
        where: { id: input.currentStatementId },
        select: { statementMonth: true, managementGroupId: true },
      })

      if (!current || current.managementGroupId !== orgId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Statement not found',
        })
      }

      const monthStatements = await ctx.db.ownerStatement.findMany({
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

      // Check for existing vendor expenses in this month
      const existingVendorExpenses =
        await ctx.db.ownerStatementExpense.findMany({
          where: {
            ownerStatementId: { in: monthStatements.map((s) => s.id) },
            vendor: input.vendor,
            description: input.description,
          },
          select: {
            ownerStatementId: true,
            vendor: true,
            description: true,
            amount: true,
            ownerStatement: {
              select: {
                property: { select: { name: true } },
              },
            },
          },
        })

      if (existingVendorExpenses.length > 0) {
        const affectedProperties = existingVendorExpenses
          .map((exp) => exp.ownerStatement.property?.name || 'Unknown Property')
          .filter((name, index, arr) => arr.indexOf(name) === index) // Remove duplicates

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Vendor "${input.vendor}" with description "${input.description}" already has expenses for this month in ${affectedProperties.length} properties: ${affectedProperties.slice(0, 3).join(', ')}${affectedProperties.length > 3 ? ` and ${affectedProperties.length - 3} more` : ''}. Please use a different description or remove existing expenses first.`,
        })
      }

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
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to parse invoice',
        })
      }

      const jsonText = result.data.response?.text() ?? '{}'
      const jsonMatch = /\{.*\}/s.exec(jsonText)
      const extractedJson = jsonMatch ? jsonMatch[0] : '{}'

      const expensesMap = parseJsonField<
        Record<string, Array<{ date?: string; amount: number }>>
      >(extractedJson, { logErrors: true, defaultValue: {} })

      if (!expensesMap || Object.keys(expensesMap).length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No property expenses found in invoice',
        })
      }

      // Collect all valid dates from the parsed expenses to determine a good default
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

      // Prepare all expense data outside the transaction
      const expenseDataToCreate: Array<{
        statementId: string
        propertyName: string
        expenses: Array<{
          ownerStatementId: string
          date: string
          description: string
          vendor: string
          amount: number
        }>
      }> = []

      for (const statement of monthStatements) {
        const propertyName = statement.property?.name
        if (!propertyName || !expensesMap[propertyName]) continue

        const expenses = expensesMap[propertyName]
        if (expenses.length === 0) continue

        const expenseData = expenses.map((expense) => {
          // Use the parsed date if valid, otherwise use the default date
          let expenseDate = expense.date?.trim()

          // Check if date is missing, empty, or invalid
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
        })

        expenseDataToCreate.push({
          statementId: statement.id,
          propertyName,
          expenses: expenseData,
        })
      }

      // Now execute the database operations in a transaction with increased timeout
      return ctx.db.$transaction(
        async (tx) => {
          const updatedProperties: string[] = []

          // Batch create all expenses
          for (const {
            statementId,
            propertyName,
            expenses,
          } of expenseDataToCreate) {
            await tx.ownerStatementExpense.createMany({
              data: expenses,
            })
            updatedProperties.push(propertyName)
          }

          // Batch recalculate all statement totals
          const recalculationPromises = expenseDataToCreate.map(
            ({ statementId }) =>
              recalculateStatementTotals(tx, statementId, userId)
          )

          await Promise.all(recalculationPromises)

          return {
            updatedCount: updatedProperties.length,
            updatedProperties,
            parsedProperties: Object.keys(expensesMap),
          }
        },
        {
          timeout: 15000, // 15 seconds timeout (Accelerate limit)
        }
      )
    }),

  importVendorExpensesFromExcel: protectedProcedure
    .input(
      z.object({
        currentStatementId: z.string(),
        expenses: z.array(
          z.object({
            property: z.string(),
            date: z.string(),
            description: z.string(),
            vendor: z.string(),
            amount: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId || !userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        })
      }

      if (input.expenses.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No expenses provided',
        })
      }

      if (input.expenses.length > 1000) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot import more than 1000 expenses at once',
        })
      }

      const current = await ctx.db.ownerStatement.findUnique({
        where: { id: input.currentStatementId },
        select: { statementMonth: true, managementGroupId: true },
      })

      if (!current || current.managementGroupId !== orgId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Statement not found',
        })
      }

      // Get all statements for this month
      const monthStatements = await ctx.db.ownerStatement.findMany({
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

      // Create a map of property names to statement IDs
      const propertyNameToStatementId = new Map<string, string>()
      monthStatements.forEach((statement) => {
        if (statement.property?.name) {
          propertyNameToStatementId.set(statement.property.name, statement.id)
        }
      })

      // Validate that all properties in the Excel exist
      const unknownProperties = input.expenses
        .map((expense) => expense.property)
        .filter((property) => !propertyNameToStatementId.has(property))
        .filter((property, index, arr) => arr.indexOf(property) === index) // Remove duplicates

      if (unknownProperties.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown properties found in Excel: ${unknownProperties.slice(0, 5).join(', ')}${unknownProperties.length > 5 ? ` and ${unknownProperties.length - 5} more` : ''}. Please ensure all property names match exactly.`,
        })
      }

      // Validate date formats
      const invalidDates = input.expenses
        .map((expense, index) => ({ expense, index }))
        .filter(({ expense }) => {
          const date = new Date(expense.date)
          return isNaN(date.getTime())
        })

      if (invalidDates.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid date formats found in rows: ${invalidDates
            .slice(0, 5)
            .map(({ index }) => index + 1)
            .join(
              ', '
            )}${invalidDates.length > 5 ? ` and ${invalidDates.length - 5} more` : ''}. Please use YYYY-MM-DD format.`,
        })
      }

      // For large datasets, process in chunks to stay within Accelerate's 15-second limit
      const CHUNK_SIZE = 200 // Process 200 expenses at a time
      const chunks = chunkArray(input.expenses, CHUNK_SIZE)

      let totalCreatedCount = 0
      const allUpdatedProperties = new Set<string>()
      const allCreatedExpenses: Array<{
        property: string
        date: string
        description: string
        vendor: string
        amount: number
      }> = []

      // Process each chunk in a separate transaction
      for (const chunk of chunks) {
        const result = await ctx.db.$transaction(
          async (tx) => {
            const updatedStatements = new Set<string>()
            const createdExpenses: Array<{
              property: string
              date: string
              description: string
              vendor: string
              amount: number
            }> = []

            // Group expenses by statement ID for batch creation
            const expensesByStatementId = new Map<string, typeof chunk>()

            for (const expense of chunk) {
              const statementId = propertyNameToStatementId.get(
                expense.property
              )
              if (!statementId) continue // This should not happen due to validation above

              if (!expensesByStatementId.has(statementId)) {
                expensesByStatementId.set(statementId, [])
              }
              expensesByStatementId.get(statementId)!.push(expense)
            }

            // Create expenses for each statement
            for (const [statementId, expenses] of expensesByStatementId) {
              await tx.ownerStatementExpense.createMany({
                data: expenses.map((expense) => ({
                  ownerStatementId: statementId,
                  date: expense.date,
                  description: expense.description,
                  vendor: expense.vendor,
                  amount: expense.amount,
                })),
              })

              updatedStatements.add(statementId)
              createdExpenses.push(...expenses)
            }

            // Batch recalculate totals for all affected statements
            const recalculationPromises = Array.from(updatedStatements).map(
              (statementId) =>
                recalculateStatementTotals(tx, statementId, userId)
            )

            await Promise.all(recalculationPromises)

            return {
              createdCount: createdExpenses.length,
              updatedProperties: Array.from(
                new Set(createdExpenses.map((expense) => expense.property))
              ),
              createdExpenses,
            }
          },
          {
            timeout: 15000, // 15 seconds timeout (Accelerate limit)
          }
        )

        totalCreatedCount += result.createdCount
        result.updatedProperties.forEach((prop) =>
          allUpdatedProperties.add(prop)
        )
        allCreatedExpenses.push(...result.createdExpenses)
      }

      return {
        createdCount: totalCreatedCount,
        updatedPropertiesCount: allUpdatedProperties.size,
        updatedProperties: Array.from(allUpdatedProperties),
        createdExpenses: allCreatedExpenses,
      }
    }),
})
