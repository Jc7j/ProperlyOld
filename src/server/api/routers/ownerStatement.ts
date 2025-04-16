import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { createTRPCRouter, protectedProcedure } from '../trpc'

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
})
