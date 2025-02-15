import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const propertyRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { orgId } = ctx.auth;

      if (!orgId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No organization selected",
        });
      }

      return ctx.db.property.findUnique({
        where: {
          managementGroupId: orgId,
          id: input.propertyId,
        },
      });
    }),

  getMany: protectedProcedure.query(async ({ ctx }) => {
    const { orgId } = ctx.auth;

    if (!orgId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No organization selected",
      });
    }

    return ctx.db.property.findMany({
      where: {
        managementGroupId: orgId,
      },
      orderBy: { name: "asc" },
    });
  }),
});
