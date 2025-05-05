import {
  type Invoice,
  type InvoiceItem,
  type OwnerStatement,
  type OwnerStatementAdjustment,
  type OwnerStatementExpense,
  type OwnerStatementIncome,
  type Property,
} from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { getUsersDisplayInfo } from '~/lib/utils/clerk'
import dayjs from '~/lib/utils/day'

import { createTRPCRouter, protectedProcedure } from '../trpc'
import { type financialDetailsSchema } from './invoice'

export const locationInfoSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
})

export const ownerSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export const editLocationSchema = z.object({
  propertyId: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
})

export const editOwnerSchema = z.object({
  propertyId: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
})

export const deletePropertySchema = z.object({
  propertyId: z.string(),
})

export type ParsedProperty = Property & {
  locationInfo: z.infer<typeof locationInfoSchema> | null
  owner: z.infer<typeof ownerSchema> | null
  invoices: Array<{
    id: string
    invoiceDate: Date
    financialDetails: {
      totalAmount: number
    } | null
    updatedAt: Date | null
    updatedBy: string
    updatedByName: string
    updatedByImageUrl: string
  }>
  totalInvoices: number
  latestInvoiceDate: Date | null
}

// Define the expected return type for the new route
type PropertyWithMonthlyData = Property & {
  monthlyInvoices: (Invoice & { items: InvoiceItem[] })[]
  monthlyOwnerStatement:
    | (OwnerStatement & {
        incomes: OwnerStatementIncome[]
        expenses: OwnerStatementExpense[]
        adjustments: OwnerStatementAdjustment[]
      })
    | null
}

export const propertyRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { orgId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const property = await ctx.db.property.findFirst({
        where: {
          id: input.propertyId,
          managementGroupId: orgId,
        },
        orderBy: {
          name: 'asc',
        },
        include: {
          invoices: {
            where: {
              deletedAt: null,
            },

            select: {
              id: true,
              invoiceDate: true,
              financialDetails: true,
              updatedAt: true,
              updatedBy: true,
              deletedAt: false,
            },
          },
        },
      })

      if (!property) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Property not found',
        })
      }

      const userIds = [...new Set(property.invoices.map((i) => i.updatedBy))]
      const userMap = await getUsersDisplayInfo(userIds)

      return {
        ...property,
        locationInfo: property.locationInfo as z.infer<
          typeof locationInfoSchema
        > | null,
        owner: property.owner as z.infer<typeof ownerSchema> | null,
        invoices: property.invoices.map((invoice) => {
          const userInfo = userMap.get(invoice.updatedBy)!
          return {
            ...invoice,
            financialDetails: invoice.financialDetails as z.infer<
              typeof financialDetailsSchema
            > | null,
            updatedByName: userInfo.name,
            updatedByImageUrl: userInfo.imageUrl,
          }
        }),
      } as ParsedProperty
    }),

  getMany: protectedProcedure.query(async ({ ctx }) => {
    const { orgId } = ctx.auth

    if (!orgId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No organization selected',
      })
    }

    const properties = await ctx.db.property.findMany({
      where: {
        managementGroupId: orgId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            invoices: {
              where: { deletedAt: null },
            },
          },
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { invoiceDate: 'desc' },
          take: 1,
          select: {
            invoiceDate: true,
          },
        },
      },
    })

    return properties.map((property) => ({
      ...property,
      locationInfo: property.locationInfo as z.infer<
        typeof locationInfoSchema
      > | null,
      owner: property.owner as z.infer<typeof ownerSchema> | null,
      totalInvoices: property._count.invoices,
      latestInvoiceDate: property.invoices[0]?.invoiceDate ?? null,
      invoices: undefined,
      _count: undefined,
    }))
  }),

  getManyMonthlyOverview: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format'),
      })
    )
    .query(async ({ ctx, input }): Promise<PropertyWithMonthlyData[]> => {
      const { orgId } = ctx.auth
      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const startDate = dayjs.utc(input.month).startOf('month').toDate()
      const endDate = dayjs.utc(input.month).endOf('month').toDate()

      const properties = await ctx.db.property.findMany({
        where: {
          managementGroupId: orgId,
          deletedAt: null,
        },
        include: {
          invoices: {
            where: {
              invoiceDate: {
                gte: startDate,
                lte: endDate,
              },
              deletedAt: null,
            },
            include: {
              items: true,
            },
          },
          ownerStatements: {
            where: {
              statementMonth: {
                gte: startDate,
                lte: endDate,
              },
            },
            include: {
              incomes: true,
              expenses: true,
              adjustments: true,
            },
            take: 1,
          },
        },
        orderBy: {
          name: 'asc',
        },
      })

      // Explicitly cast the result to the defined type before mapping
      const typedProperties = properties as (Property & {
        invoices: (Invoice & { items: InvoiceItem[] })[]
        ownerStatements: (OwnerStatement & {
          incomes: OwnerStatementIncome[]
          expenses: OwnerStatementExpense[]
          adjustments: OwnerStatementAdjustment[]
        })[]
      })[]

      return typedProperties.map((property) => ({
        ...property,
        monthlyInvoices: property.invoices,
        monthlyOwnerStatement: property.ownerStatements[0] ?? null,
      }))
    }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    const { orgId, userId } = ctx.auth

    if (!orgId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No organization selected',
      })
    }

    if (!userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not authenticated',
      })
    }

    const newProperty = await ctx.db.property.create({
      data: {
        managementGroupId: orgId,
        name: 'New Property',
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    if (!newProperty) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create property',
      })
    }

    return newProperty.id
  }),

  editLocation: protectedProcedure
    .input(editLocationSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const locationInfo = {
        address: input.address,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
      }

      return ctx.db.property.update({
        where: {
          id: input.propertyId,
          managementGroupId: orgId,
        },
        data: {
          locationInfo,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      })
    }),

  editOwner: protectedProcedure
    .input(editOwnerSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const ownerInfo = {
        name: input.name,
        email: input.email,
        phone: input.phone,
      }

      return ctx.db.property.update({
        where: {
          id: input.propertyId,
          managementGroupId: orgId,
        },
        data: {
          owner: ownerInfo,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      })
    }),

  editName: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        name: z.string().min(1, 'Name is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      return ctx.db.property.update({
        where: {
          id: input.propertyId,
          managementGroupId: orgId,
        },
        data: {
          name: input.name,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      })
    }),

  delete: protectedProcedure
    .input(deletePropertySchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const property = await ctx.db.property.findFirst({
        where: {
          id: input.propertyId,
          managementGroupId: orgId,
          deletedAt: null,
        },
      })

      if (!property) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Property not found',
        })
      }

      return ctx.db.property.update({
        where: { id: input.propertyId },
        data: {
          deletedAt: new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
        },
      })
    }),
})
