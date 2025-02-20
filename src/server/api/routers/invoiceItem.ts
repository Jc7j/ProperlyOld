import { type InvoiceItem, type Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { createTRPCRouter, protectedProcedure } from '../trpc'

const TAX_RATE = 0.08375 // 8.375%
const MANAGEMENT_FEE_NAME = 'Property Management Fee'

export const createInvoiceItemSchema = z
  .object({
    invoiceId: z.string(),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    price: z.number().min(0, 'Price must be non-negative'),
    date: z.date().nullable(),
    // Make both fields optional initially
    customItemName: z.string().optional(),
    managementGroupItemId: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasCustomItem = !!data.customItemName
      const hasManagementItem = !!data.managementGroupItemId
      return hasCustomItem !== hasManagementItem // XOR - exactly one must be true
    },
    {
      message:
        'Must provide either a custom item name or select a supply item, but not both',
    }
  )

// Add this schema
export const updateInvoiceItemSchema = z
  .object({
    id: z.string(),
    invoiceId: z.string(),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    price: z.number().min(0, 'Price must be non-negative'),
    date: z.date().nullable(),
    customItemName: z.string().optional(),
    managementGroupItemId: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasCustomItem = !!data.customItemName
      const hasManagementItem = !!data.managementGroupItemId
      return hasCustomItem !== hasManagementItem
    },
    {
      message:
        'Must provide either a custom item name or select a supply item, but not both',
    }
  )

async function recalculateInvoiceFinancials(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  userId: string
) {
  const allItems = await tx.invoiceItem.findMany({
    where: { invoiceId },
    include: {
      managementGroupItem: true,
    },
  })

  const managementFeeItem = allItems.find(
    (item: InvoiceItem) => item.customItemName === MANAGEMENT_FEE_NAME
  )
  const managementFeeAmount = managementFeeItem
    ? Number(managementFeeItem.price) * managementFeeItem.quantity
    : 0

  const subTotal = allItems.reduce((acc: number, item: InvoiceItem) => {
    if (item.customItemName !== MANAGEMENT_FEE_NAME) {
      return acc + Number(item.price) * item.quantity
    }
    return acc
  }, 0)

  const taxableAmount = allItems.reduce((acc: number, item: InvoiceItem) => {
    if (item.managementGroupItemsId) {
      return acc + Number(item.price) * item.quantity
    }
    return acc
  }, 0)

  const taxAmount = Math.round(taxableAmount * TAX_RATE)
  const totalAmount = subTotal + managementFeeAmount + taxAmount

  const financialDetails = {
    subTotal,
    managementFeeAmount,
    taxableAmount,
    taxAmount,
    totalAmount,
  }

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      financialDetails: financialDetails as Prisma.JsonObject,
      updatedBy: userId,
      updatedAt: new Date(),
    },
  })

  return financialDetails
}

async function handleInventoryChange(
  tx: Prisma.TransactionClient,
  managementGroupItemId: string | null | undefined,
  quantityChange: number,
  orgId: string,
  userId: string
): Promise<void> {
  if (!managementGroupItemId) return

  const item = await tx.managementGroupItems.findFirst({
    where: {
      id: managementGroupItemId,
      managementGroupId: orgId,
    },
  })

  if (!item) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Supply item not found',
    })
  }

  const newQuantityUsed = (item.quantityUsed ?? 0) + quantityChange
  const newQuantityOnHand = item.quantityTotal - newQuantityUsed

  await tx.managementGroupItems.update({
    where: { id: managementGroupItemId },
    data: {
      quantityUsed: newQuantityUsed,
      quantityOnHand: newQuantityOnHand,
      updatedBy: userId,
      updatedAt: new Date(),
    },
  })
}

export const invoiceItemRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createInvoiceItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      return ctx.db.$transaction(async (tx) => {
        // Verify invoice exists and belongs to org
        const invoice = await tx.invoice.findFirst({
          where: {
            id: input.invoiceId,
            property: {
              managementGroupId: orgId,
            },
          },
        })

        if (!invoice) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invoice not found',
          })
        }

        // Handle inventory if using management group item
        if (input.managementGroupItemId) {
          await handleInventoryChange(
            tx,
            input.managementGroupItemId,
            input.quantity,
            orgId,
            userId
          )
        }

        const newItem = await tx.invoiceItem.create({
          data: {
            invoiceId: input.invoiceId,
            quantity: input.quantity,
            price: Math.round(input.price * 100),
            date: input.date,
            customItemName: input.customItemName,
            managementGroupItemsId: input.managementGroupItemId,
            createdBy: userId,
          },
        })

        await recalculateInvoiceFinancials(tx, input.invoiceId, userId)

        return {
          ...newItem,
          price: Number(newItem.price),
        }
      })
    }),

  update: protectedProcedure
    .input(updateInvoiceItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      if (!orgId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No organization selected',
        })
      }

      return ctx.db.$transaction(async (tx) => {
        const originalItem = await tx.invoiceItem.findFirst({
          where: {
            id: input.id,
            invoiceId: input.invoiceId,
          },
        })

        if (!originalItem) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invoice item not found',
          })
        }

        // Handle inventory changes
        if (
          originalItem.managementGroupItemsId !== input.managementGroupItemId
        ) {
          // Revert original item's inventory if it was a management item
          if (originalItem.managementGroupItemsId) {
            await handleInventoryChange(
              tx,
              originalItem.managementGroupItemsId,
              -originalItem.quantity,
              orgId,
              userId
            )
          }

          // Add new item's inventory if it's a management item
          if (input.managementGroupItemId) {
            await handleInventoryChange(
              tx,
              input.managementGroupItemId,
              input.quantity,
              orgId,
              userId
            )
          }
        } else if (input.managementGroupItemId) {
          // Handle quantity change for same item
          const quantityDiff = input.quantity - originalItem.quantity
          if (quantityDiff !== 0) {
            await handleInventoryChange(
              tx,
              input.managementGroupItemId,
              quantityDiff,
              orgId,
              userId
            )
          }
        }

        const updatedItem = await tx.invoiceItem.update({
          where: { id: input.id },
          data: {
            quantity: input.quantity,
            price: Math.round(input.price * 100),
            date: input.date,
            customItemName: input.customItemName,
            managementGroupItemsId: input.managementGroupItemId,
          },
        })

        await recalculateInvoiceFinancials(tx, input.invoiceId, userId)

        return {
          ...updatedItem,
          price: Number(updatedItem.price),
        }
      })
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        invoiceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = ctx.auth

      return ctx.db.$transaction(async (tx) => {
        const itemToDelete = await tx.invoiceItem.findFirst({
          where: {
            id: input.id,
            invoiceId: input.invoiceId,
            invoice: {
              property: {
                managementGroupId: orgId,
              },
            },
          },
        })

        if (!itemToDelete) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Invoice item not found',
          })
        }

        // Handle inventory adjustment for management items
        if (itemToDelete.managementGroupItemsId) {
          await handleInventoryChange(
            tx,
            itemToDelete.managementGroupItemsId,
            -itemToDelete.quantity,
            orgId!,
            userId
          )
        }

        await tx.invoiceItem.delete({
          where: {
            id: input.id,
          },
        })

        await recalculateInvoiceFinancials(tx, input.invoiceId, userId)

        return { success: true }
      })
    }),
})
