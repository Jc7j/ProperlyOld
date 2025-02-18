import { type Property } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { getUsersDisplayInfo } from '~/lib/utils/clerk'

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
        include: {
          invoices: {
            orderBy: {
              invoiceDate: 'desc',
            },
            select: {
              id: true,
              invoiceDate: true,
              financialDetails: true,
              updatedAt: true,
              updatedBy: true,
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
      } satisfies ParsedProperty
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
      },
      orderBy: { name: 'asc' },
    })

    return properties.map((property) => ({
      ...property,
      locationInfo: property.locationInfo as z.infer<
        typeof locationInfoSchema
      > | null,
      owner: property.owner as z.infer<typeof ownerSchema> | null,
    })) as ParsedProperty[]
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
})
