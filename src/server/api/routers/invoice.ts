import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { getUserDisplayInfo } from '~/lib/utils/clerk'

import { createTRPCRouter, protectedProcedure } from '../trpc'

export const financialDetailsSchema = z.object({
  totalAmount: z.number(),
  subtotal: z.number(),
  taxAmount: z.number(),
  managementFeeAmount: z.number(),
})

export interface InvoiceWithUser {
  id: string
  invoiceDate: Date
  financialDetails: z.infer<typeof financialDetailsSchema> | null
  propertyId: string | null
  managementGroupId: string
  createdAt: Date | null
  updatedAt: Date | null
  createdBy: string
  updatedBy: string
  createdByName: string
  createdByImageUrl: string
  updatedByName: string
  updatedByImageUrl: string
  items: {
    id: string
    invoiceId: string
    quantity: number
    price: number
    managementGroupItemsId: string | null
    managementGroupItem: {
      name: string
    } | null
    customItemName: string | null
    date: Date | null
  }[]
}

export const deleteInvoiceSchema = z.object({
  invoiceId: z.string(),
  propertyId: z.string(),
})

export const invoiceRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
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

      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.invoiceId,
          propertyId: input.propertyId,
          managementGroupId: orgId,
          deletedAt: null,
        },
        include: {
          items: {
            include: {
              managementGroupItem: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      // Get user info in parallel
      const [createdByInfo, updatedByInfo] = await Promise.all([
        getUserDisplayInfo(invoice.createdBy),
        getUserDisplayInfo(invoice.updatedBy),
      ])

      return {
        ...invoice,
        financialDetails: invoice.financialDetails as z.infer<
          typeof financialDetailsSchema
        > | null,
        createdByName: createdByInfo.name,
        createdByImageUrl: createdByInfo.imageUrl,
        updatedByName: updatedByInfo.name,
        updatedByImageUrl: updatedByInfo.imageUrl,
        items: invoice.items.map((item) => ({
          ...item,
          price: Number(item.price),
        })),
      } satisfies InvoiceWithUser
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.string(),
        invoiceDate: z.date(),
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

      const newInvoice = await ctx.db.invoice.create({
        data: {
          managementGroupId: orgId,
          propertyId: input.propertyId,
          invoiceDate: input.invoiceDate,
          createdBy: userId,
          updatedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      return newInvoice.id
    }),

  delete: protectedProcedure
    .input(deleteInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.invoiceId,
          propertyId: input.propertyId,
          managementGroupId: orgId,
          deletedAt: null,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        })
      }

      return ctx.db.invoice.update({
        where: { id: input.invoiceId },
        data: {
          deletedAt: new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
        },
      })
    }),
})
