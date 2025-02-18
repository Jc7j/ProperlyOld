import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc'

import { invoiceRouter } from './routers/invoice'
import { invoiceItemRouter } from './routers/invoiceItem'
import { managementGroupItemsRouter } from './routers/managementGroupItems'
import { propertyRouter } from './routers/property'

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  property: propertyRouter,
  invoice: invoiceRouter,
  managementGroupItems: managementGroupItemsRouter,
  invoiceItem: invoiceItemRouter,
})

// export type definition of API
export type AppRouter = typeof appRouter

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter)
