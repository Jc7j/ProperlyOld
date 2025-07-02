import type { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { VendorCache } from '~/lib/OwnerStatement/vendor-cache'
import type {
  MatchedPropertyPreview,
  UnmatchedPropertyPreview,
  VendorImportPreviewResponse,
} from '~/lib/OwnerStatement/vendor-import'
import { matchPropertiesWithGPT } from '~/lib/ai/ai'

import { createTRPCRouter, protectedProcedure } from '../trpc'

// Optimized property fetching with caching
async function getCachedMonthProperties(
  db: Prisma.TransactionClient,
  orgId: string,
  statementMonth: Date
) {
  const monthKey = `${statementMonth.getUTCFullYear()}-${String(statementMonth.getUTCMonth() + 1).padStart(2, '0')}`

  // Try cache first
  const cached = await VendorCache.getPropertyMappings(orgId, monthKey)
  if (cached) {
    return cached
  }

  // Fetch from database with optimized query
  const monthStatements = await db.ownerStatement.findMany({
    where: {
      managementGroupId: orgId,
      statementMonth,
      deletedAt: null,
    },
    select: {
      id: true,
      propertyId: true,
      property: {
        select: {
          id: true,
          name: true,
          locationInfo: true,
        },
      },
    },
  })

  // Transform and cache
  const properties = monthStatements
    .map((statement) => statement.property)
    .filter(
      (property): property is NonNullable<typeof property> => property !== null
    )
    .map((property) => ({
      id: property.id,
      name: property.name,
      address:
        (property.locationInfo as { address?: string } | null)?.address ?? null,
      statementId:
        monthStatements.find((s) => s.property?.id === property.id)?.id ?? '',
    }))

  // Cache for future use
  await VendorCache.setPropertyMappings(orgId, monthKey, properties)

  return properties
}

// Optimized GPT matching with caching
async function getCachedGPTMatching(
  importPropertyNames: string[],
  databaseProperties: Array<{
    id: string
    name: string
    address: string | null
  }>
) {
  // Try cache first
  const cached = await VendorCache.getGPTMappings(
    importPropertyNames,
    databaseProperties
  )
  if (cached) {
    return cached
  }

  // Call GPT
  const gptResult = await matchPropertiesWithGPT({
    importProperties: importPropertyNames,
    databaseProperties,
  })

  // Cache result
  await VendorCache.setGPTMappings(
    importPropertyNames,
    databaseProperties,
    gptResult
  )

  return gptResult
}

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
  // Ensure all values are properly converted to numbers, handling Decimal objects
  const safeParseDecimal = (value: any): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'object' && value.toString) {
      return parseFloat(value.toString()) || 0
    }
    return parseFloat(String(value)) || 0
  }

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

  // Use the same safe decimal parsing as in calculateTotals
  const safeParseDecimal = (value: any): number => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'object' && value.toString) {
      return parseFloat(value.toString()) || 0
    }
    return parseFloat(String(value)) || 0
  }

  const totals = calculateTotals(
    incomes.map((i) => ({
      checkIn: i.checkIn,
      checkOut: i.checkOut,
      days: i.days,
      platform: i.platform,
      guest: i.guest,
      grossRevenue: safeParseDecimal(i.grossRevenue),
      hostFee: safeParseDecimal(i.hostFee),
      platformFee: safeParseDecimal(i.platformFee),
      grossIncome: safeParseDecimal(i.grossIncome),
    })),
    expenses.map((e) => ({
      date: e.date,
      description: e.description,
      vendor: e.vendor,
      amount: safeParseDecimal(e.amount),
    })),
    adjustments.map((a) => ({
      checkIn: a.checkIn ?? undefined,
      checkOut: a.checkOut ?? undefined,
      description: a.description,
      amount: safeParseDecimal(a.amount),
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

      const result = await ctx.db.$transaction(async (tx) => {
        let item: any
        let statementId: string

        // Get the item and verify ownership
        if (input.section === 'incomes') {
          item = await tx.ownerStatementIncome.findUnique({
            where: { id: input.id },
            include: {
              ownerStatement: {
                select: {
                  managementGroupId: true,
                  id: true,
                  statementMonth: true,
                },
              },
            },
          })
          statementId = item?.ownerStatement.id
        } else if (input.section === 'expenses') {
          item = await tx.ownerStatementExpense.findUnique({
            where: { id: input.id },
            include: {
              ownerStatement: {
                select: {
                  managementGroupId: true,
                  id: true,
                  statementMonth: true,
                },
              },
            },
          })
          statementId = item?.ownerStatement.id
        } else {
          item = await tx.ownerStatementAdjustment.findUnique({
            where: { id: input.id },
            include: {
              ownerStatement: {
                select: {
                  managementGroupId: true,
                  id: true,
                  statementMonth: true,
                },
              },
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

        const updatedStatement = await recalculateStatementTotals(
          tx,
          statementId,
          userId
        )

        // Invalidate cache after successful update
        const monthKey = `${item.ownerStatement.statementMonth.getUTCFullYear()}-${String(item.ownerStatement.statementMonth.getUTCMonth() + 1).padStart(2, '0')}`
        await VendorCache.invalidateMonth(orgId, monthKey)

        return updatedStatement
      })

      return result
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
    .mutation(async ({ ctx, input }): Promise<VendorImportPreviewResponse> => {
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

      // Get cached properties for this month (optimized)
      const databaseProperties = await getCachedMonthProperties(
        ctx.db,
        orgId,
        current.statementMonth
      )

      // Get unique property names from import data
      const importPropertyNames = [
        ...new Set(input.expenses.map((expense) => expense.property)),
      ]

      // Use cached GPT matching
      let gptMatchResult
      try {
        gptMatchResult = await getCachedGPTMatching(
          importPropertyNames,
          databaseProperties.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address,
          }))
        )
      } catch (error) {
        console.error('GPT matching failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Property matching service failed. Please try again.',
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

      // Basic duplicate detection - check for exact matches in the same batch
      const expenseKeys = new Set<string>()
      const duplicates: string[] = []

      input.expenses.forEach((expense, index) => {
        // Create a unique key for each expense
        const key = `${expense.property}|${expense.date}|${expense.description}|${expense.vendor}|${expense.amount}`
        if (expenseKeys.has(key)) {
          duplicates.push(`Row ${index + 1}: Duplicate expense found`)
        } else {
          expenseKeys.add(key)
        }
      })

      if (duplicates.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Found ${duplicates.length} duplicate expenses in the Excel file. Please remove duplicates and try again.`,
        })
      }

      // Prepare preview data
      const matched: MatchedPropertyPreview[] = []
      const unmatched: UnmatchedPropertyPreview[] = []

      // Group expenses by property match status
      const expensesByProperty = new Map<string, typeof input.expenses>()

      for (const expense of input.expenses) {
        if (!expensesByProperty.has(expense.property)) {
          expensesByProperty.set(expense.property, [])
        }
        expensesByProperty.get(expense.property)!.push(expense)
      }

      // Process matched properties
      for (const [importPropertyName, match] of Object.entries(
        gptMatchResult.matches
      )) {
        const dbProperty = databaseProperties.find(
          (p) => p.id === match.propertyId
        )
        const expenses = expensesByProperty.get(importPropertyName) ?? []

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
            expenses: expenses.map((exp) => ({
              date: exp.date,
              description: exp.description,
              vendor: exp.vendor,
              amount: exp.amount,
            })),
            totalAmount: parseFloat(totalAmount.toFixed(2)),
          })
        }
      }

      // Process unmatched properties
      for (const unmatchedPropertyName of gptMatchResult.unmatched) {
        const expenses = expensesByProperty.get(unmatchedPropertyName) ?? []

        if (expenses.length > 0) {
          const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0)

          unmatched.push({
            propertyName: unmatchedPropertyName,
            expenses: expenses.map((exp) => ({
              date: exp.date,
              description: exp.description,
              vendor: exp.vendor,
              amount: exp.amount,
            })),
            totalAmount: parseFloat(totalAmount.toFixed(2)),
          })
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

      return {
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
    }),

  createIncomeItem: protectedProcedure
    .input(
      z.object({
        ownerStatementId: z.string(),
        checkIn: z.string().default(''),
        checkOut: z.string().default(''),
        days: z.number().default(0),
        platform: z.string().default(''),
        guest: z.string().default(''),
        grossRevenue: z.number().default(0),
        hostFee: z.number().default(0),
        platformFee: z.number().default(0),
        grossIncome: z.number().default(0),
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

      // Verify statement ownership
      const statement = await ctx.db.ownerStatement.findUnique({
        where: { id: input.ownerStatementId },
        select: { managementGroupId: true },
      })

      if (!statement || statement.managementGroupId !== orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        })
      }

      return ctx.db.$transaction(async (tx) => {
        const newIncome = await tx.ownerStatementIncome.create({
          data: {
            ownerStatementId: input.ownerStatementId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            days: input.days,
            platform: input.platform,
            guest: input.guest,
            grossRevenue: input.grossRevenue,
            hostFee: input.hostFee,
            platformFee: input.platformFee,
            grossIncome: input.grossIncome,
          },
        })

        // Recalculate statement totals
        await recalculateStatementTotals(tx, input.ownerStatementId, userId)

        return newIncome
      })
    }),

  createExpenseItem: protectedProcedure
    .input(
      z.object({
        ownerStatementId: z.string(),
        date: z.string().default(''),
        description: z.string().default(''),
        vendor: z.string().default(''),
        amount: z.number().default(0),
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

      // Verify statement ownership
      const statement = await ctx.db.ownerStatement.findUnique({
        where: { id: input.ownerStatementId },
        select: { managementGroupId: true },
      })

      if (!statement || statement.managementGroupId !== orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        })
      }

      return ctx.db.$transaction(async (tx) => {
        const newExpense = await tx.ownerStatementExpense.create({
          data: {
            ownerStatementId: input.ownerStatementId,
            date: input.date,
            description: input.description,
            vendor: input.vendor,
            amount: input.amount,
          },
        })

        // Recalculate statement totals
        await recalculateStatementTotals(tx, input.ownerStatementId, userId)

        return newExpense
      })
    }),

  createAdjustmentItem: protectedProcedure
    .input(
      z.object({
        ownerStatementId: z.string(),
        checkIn: z.string().optional(),
        checkOut: z.string().optional(),
        description: z.string().default(''),
        amount: z.number().default(0),
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

      // Verify statement ownership
      const statement = await ctx.db.ownerStatement.findUnique({
        where: { id: input.ownerStatementId },
        select: { managementGroupId: true },
      })

      if (!statement || statement.managementGroupId !== orgId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        })
      }

      return ctx.db.$transaction(async (tx) => {
        const newAdjustment = await tx.ownerStatementAdjustment.create({
          data: {
            ownerStatementId: input.ownerStatementId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            description: input.description,
            amount: input.amount,
          },
        })

        // Recalculate statement totals
        await recalculateStatementTotals(tx, input.ownerStatementId, userId)

        return newAdjustment
      })
    }),

  deleteIncomeItem: protectedProcedure
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
        // Get the income item and verify ownership
        const incomeItem = await tx.ownerStatementIncome.findUnique({
          where: { id: input.id },
          include: {
            ownerStatement: {
              select: { managementGroupId: true, id: true },
            },
          },
        })

        if (!incomeItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Income item not found',
          })
        }

        if (incomeItem.ownerStatement.managementGroupId !== orgId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          })
        }

        // Delete the income item
        await tx.ownerStatementIncome.delete({
          where: { id: input.id },
        })

        // Recalculate statement totals
        await recalculateStatementTotals(
          tx,
          incomeItem.ownerStatement.id,
          userId
        )

        return { success: true }
      })
    }),

  deleteExpenseItem: protectedProcedure
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
        // Get the expense item and verify ownership
        const expenseItem = await tx.ownerStatementExpense.findUnique({
          where: { id: input.id },
          include: {
            ownerStatement: {
              select: { managementGroupId: true, id: true },
            },
          },
        })

        if (!expenseItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Expense item not found',
          })
        }

        if (expenseItem.ownerStatement.managementGroupId !== orgId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          })
        }

        // Delete the expense item
        await tx.ownerStatementExpense.delete({
          where: { id: input.id },
        })

        // Recalculate statement totals
        await recalculateStatementTotals(
          tx,
          expenseItem.ownerStatement.id,
          userId
        )

        return { success: true }
      })
    }),

  deleteAdjustmentItem: protectedProcedure
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
        // Get the adjustment item and verify ownership
        const adjustmentItem = await tx.ownerStatementAdjustment.findUnique({
          where: { id: input.id },
          include: {
            ownerStatement: {
              select: { managementGroupId: true, id: true },
            },
          },
        })

        if (!adjustmentItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Adjustment item not found',
          })
        }

        if (adjustmentItem.ownerStatement.managementGroupId !== orgId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          })
        }

        // Delete the adjustment item
        await tx.ownerStatementAdjustment.delete({
          where: { id: input.id },
        })

        // Recalculate statement totals
        await recalculateStatementTotals(
          tx,
          adjustmentItem.ownerStatement.id,
          userId
        )

        return { success: true }
      })
    }),

  deleteAllForMonth: protectedProcedure
    .input(
      z.object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
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
        // Find all statements for the given month
        const statements = await tx.ownerStatement.findMany({
          where: {
            managementGroupId: orgId,
            deletedAt: null,
          },
          select: {
            id: true,
            statementMonth: true,
          },
        })

        // Filter by month (same logic as getMany)
        const statementsToDelete = statements.filter((statement) => {
          const statementDate = new Date(statement.statementMonth)
          const statementMonth = `${statementDate.getUTCFullYear()}-${String(statementDate.getUTCMonth() + 1).padStart(2, '0')}`
          return statementMonth === input.month
        })

        if (statementsToDelete.length === 0) {
          return {
            success: true,
            deletedCount: 0,
            message: 'No statements found for the specified month',
          }
        }

        // Soft delete all statements
        const statementIds = statementsToDelete.map((s) => s.id)
        await tx.ownerStatement.updateMany({
          where: {
            id: { in: statementIds },
          },
          data: {
            deletedAt: new Date(),
            updatedBy: userId,
          },
        })

        return {
          success: true,
          deletedCount: statementsToDelete.length,
          message: `Successfully deleted ${statementsToDelete.length} statements`,
        }
      })
    }),
})
