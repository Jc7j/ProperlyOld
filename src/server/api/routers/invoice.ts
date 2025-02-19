import { type InvoiceImage } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { subMonths } from 'date-fns'
import { z } from 'zod'
import { getUserDisplayInfo } from '~/lib/utils/clerk'
import { utapi } from '~/server/uploadthing'

import { createTRPCRouter, protectedProcedure } from '../trpc'
import {
  type InvoiceFinancialDetails,
  type PropertyLocationInfo,
  type PropertyOwner,
} from '../types'

export const financialDetailsSchema = z.object({
  totalAmount: z.number(),
  subtotal: z.number(),
  taxAmount: z.number(),
  managementFeeAmount: z.number(),
})

export interface InvoiceWithUser {
  id: string
  invoiceDate: Date
  financialDetails: InvoiceFinancialDetails
  propertyId: string | null
  managementGroupId: string
  createdAt: Date | null
  updatedAt: Date | null
  createdBy: string
  updatedBy: string
  createdByName?: string
  createdByImageUrl?: string
  updatedByName?: string
  updatedByImageUrl?: string
  items?: {
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
  property?: {
    name: string
    locationInfo: PropertyLocationInfo
    owner: PropertyOwner | null
  }
  images?: InvoiceImage[]
}

export const deleteInvoiceSchema = z.object({
  invoiceId: z.string(),
  propertyId: z.string(),
})

export const invoiceRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(), // YYYY-MM format
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

      const where = {
        managementGroupId: orgId,
        deletedAt: null,
        ...(input.month
          ? {
              invoiceDate: {
                gte: new Date(`${input.month}-01`),
                lt: new Date(
                  new Date(`${input.month}-01`).setMonth(
                    new Date(`${input.month}-01`).getMonth() + 1
                  )
                ),
              },
            }
          : {}),
      }

      const invoices = await ctx.db.invoice.findMany({
        where,
        take: input.limit,
        orderBy: {
          invoiceDate: 'desc',
        },
        include: {
          property: {
            select: {
              name: true,
              locationInfo: true,
              owner: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
              createdAt: true,
            },
          },
        },
      })

      return invoices.map((invoice) => ({
        ...invoice,
        financialDetails: invoice.financialDetails as InvoiceFinancialDetails,
        property: {
          name: invoice.property?.name,
          locationInfo: invoice.property
            ?.locationInfo as unknown as PropertyLocationInfo,
          owner: invoice.property?.owner as unknown as PropertyOwner,
        },
        images: invoice.images as unknown as InvoiceImage[],
      })) as InvoiceWithUser[]
    }),

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
          images: {
            select: {
              id: true,
              url: true,
              createdAt: true,
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
        financialDetails: invoice.financialDetails as InvoiceFinancialDetails,
        createdByName: createdByInfo.name,
        createdByImageUrl: createdByInfo.imageUrl,
        updatedByName: updatedByInfo.name,
        updatedByImageUrl: updatedByInfo.imageUrl,
        items: invoice.items.map((item) => ({
          ...item,
          price: Number(item.price),
        })),
        images: invoice.images as unknown as InvoiceImage[],
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

  getPastYearTotals: protectedProcedure.query(async ({ ctx }) => {
    const { orgId } = ctx.auth

    if (!orgId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No organization selected',
      })
    }

    const startDate = subMonths(new Date(), 12)

    const invoices = await ctx.db.invoice.findMany({
      where: {
        managementGroupId: orgId,
        deletedAt: null,
        invoiceDate: {
          gte: startDate,
        },
      },
      select: {
        invoiceDate: true,
        financialDetails: true,
      },
      orderBy: {
        invoiceDate: 'asc',
      },
    })

    // Group by month and sum totals
    const monthlyTotals = invoices.reduce<
      Array<{ date: string; total: number }>
    >((acc, invoice) => {
      const date = new Date(invoice.invoiceDate)
      const monthKey = date.toISOString().slice(0, 7) // YYYY-MM format

      const existingMonth = acc.find((item) => item.date === monthKey)
      const financialDetails =
        invoice.financialDetails as InvoiceFinancialDetails
      // Convert cents to dollars here
      const amount = financialDetails?.totalAmount ?? 0

      if (existingMonth) {
        existingMonth.total += amount
      } else {
        acc.push({ date: monthKey, total: amount })
      }

      return acc
    }, [])

    return monthlyTotals
  }),

  addImage: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        propertyId: z.string(),
        url: z.string().url(),
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

      return ctx.db.invoiceImage.create({
        data: {
          url: input.url,
          createdBy: userId,
          invoice: {
            connect: {
              id: input.invoiceId,
            },
          },
        },
      })
    }),

  removeImage: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        propertyId: z.string(),
        imageUrl: z.string().url(),
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

      // Find the image to delete
      const image = await ctx.db.invoiceImage.findFirst({
        where: {
          url: input.imageUrl,
          invoiceId: input.invoiceId,
          invoice: {
            propertyId: input.propertyId,
            managementGroupId: orgId,
            deletedAt: null,
          },
        },
      })

      if (image?.createdBy !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the uploader can delete the image',
        })
      }

      if (!image) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Image not found',
        })
      }

      // Extract the file key from the URL
      // URL format: https://uploadthing.com/f/[file-key]
      const fileKey = image.url.split('/').pop()
      if (!fileKey) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Invalid file URL',
        })
      }

      // Delete from UploadThing first
      try {
        await utapi.deleteFiles(fileKey)
      } catch (error) {
        console.error('Failed to delete file from UploadThing:', error)
        // Continue with database deletion even if UploadThing deletion fails
      }

      // Delete from database
      return ctx.db.invoiceImage.delete({
        where: {
          id: image.id,
          createdBy: userId,
        },
      })
    }),
})
