import { type ManagementGroupItems } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { getUsersDisplayInfo } from '~/lib/utils/clerk'

import { createTRPCRouter, protectedProcedure } from '../trpc'

export interface ManagementGroupItemWithUser
  extends Omit<ManagementGroupItems, 'defaultPrice'> {
  defaultPrice: number
  createdByName: string
  createdByImageUrl: string
  updatedByName: string
  updatedByImageUrl: string
}

export const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  defaultPrice: z
    .number()
    .min(0, 'Price must be positive')
    .transform((val) => Math.round(val * 100)),
  description: z.string().optional(),
  link: z.string().url().optional().or(z.literal('')),
  quantityOnHand: z.string().optional(),
})

export const updateQuantitySchema = z.object({
  id: z.string(),
  quantityOnHand: z.number().min(0, 'Quantity must be positive'),
})

export const editItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  defaultPrice: z
    .number()
    .min(0, 'Price must be positive')
    .transform((val) => Math.round(val * 100)),
  description: z.string().optional(),
  link: z.string().url().optional().or(z.literal('')),
})

export const managementGroupItemsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const newItem = await ctx.db.managementGroupItems.create({
        data: {
          managementGroupId: orgId,
          name: input.name,
          defaultPrice: input.defaultPrice,
          description: input.description ?? null,
          link: input.link ?? null,
          quantityOnHand: input.quantityOnHand
            ? parseInt(input.quantityOnHand)
            : 0,
          quantityUsed: 0,
          createdBy: userId,
          updatedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      if (!newItem) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create item',
        })
      }

      return newItem
    }),

  getMany: protectedProcedure.query(async ({ ctx }) => {
    const { orgId } = ctx.auth

    if (!orgId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No organization selected',
      })
    }

    const items = await ctx.db.managementGroupItems.findMany({
      where: {
        managementGroupId: orgId,
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Get unique user IDs
    const userIds = [
      ...new Set(items.flatMap((item) => [item.createdBy, item.updatedBy])),
    ]
    const userMap = await getUsersDisplayInfo(userIds)

    return items.map((item) => {
      const createdByInfo = userMap.get(item.createdBy)!
      const updatedByInfo = userMap.get(item.updatedBy)!

      return {
        ...item,
        defaultPrice: Number(item.defaultPrice),
        createdByName: createdByInfo.name,
        createdByImageUrl: createdByInfo.imageUrl,
        updatedByName: updatedByInfo.name,
        updatedByImageUrl: updatedByInfo.imageUrl,
      }
    }) satisfies ManagementGroupItemWithUser[]
  }),

  updateQuantity: protectedProcedure
    .input(updateQuantitySchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const updatedItem = await ctx.db.managementGroupItems.update({
        where: {
          id: input.id,
          managementGroupId: orgId,
        },
        data: {
          quantityOnHand: input.quantityOnHand,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      })

      if (!updatedItem) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update quantity',
        })
      }

      return updatedItem
    }),

  edit: protectedProcedure
    .input(editItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const updatedItem = await ctx.db.managementGroupItems.update({
        where: {
          id: input.id,
          managementGroupId: orgId,
        },
        data: {
          name: input.name,
          defaultPrice: input.defaultPrice,
          description: input.description ?? null,
          link: input.link ?? null,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      })

      if (!updatedItem) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update item',
        })
      }

      return updatedItem
    }),
})
