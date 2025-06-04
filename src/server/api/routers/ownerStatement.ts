import type { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

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
