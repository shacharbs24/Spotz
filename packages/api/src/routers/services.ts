import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, protectedProcedure } from "../trpc";
import { serviceInputSchema } from "../schemas/service";

/**
 * Resolves the authenticated owner's business, enforcing the OWNER role.
 * Throws for non-owners / missing business — used by the write procedures.
 */
async function requireOwnerBusiness(clerkUserId: string) {
  const [user] = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.clerkUserId, clerkUserId));

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "המשתמש לא נמצא." });
  }
  if (user.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "רק בעלי עסק יכולים לנהל שירותים.",
    });
  }

  const [business] = await db
    .select()
    .from(tables.businesses)
    .where(eq(tables.businesses.ownerId, user.id));

  if (!business) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "צרו תחילה את פרטי העסק לפני הוספת שירותים.",
    });
  }

  return business;
}

/** Confirms a service exists and belongs to the given business. */
async function requireOwnedService(serviceId: string, businessId: string) {
  const [service] = await db
    .select()
    .from(tables.services)
    .where(eq(tables.services.id, serviceId));

  if (!service || service.businessId !== businessId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "השירות לא נמצא." });
  }
  return service;
}

const serviceIdSchema = z.object({ id: z.string().uuid() });

export const servicesRouter = router({
  /** All services for the current owner's business (empty if none / not owner). */
  getServices: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.clerkUserId, ctx.clerkUserId));

    if (!user || user.role !== "OWNER") return [];

    const [business] = await db
      .select()
      .from(tables.businesses)
      .where(eq(tables.businesses.ownerId, user.id));

    if (!business) return [];

    return db
      .select()
      .from(tables.services)
      .where(eq(tables.services.businessId, business.id))
      .orderBy(asc(tables.services.createdAt));
  }),

  createService: protectedProcedure
    .input(serviceInputSchema)
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnerBusiness(ctx.clerkUserId);

      const [created] = await db
        .insert(tables.services)
        .values({
          businessId: business.id,
          name: input.name,
          description: input.description?.trim() || null,
          durationMinutes: input.durationMinutes,
          priceCents: input.priceAgorot,
        })
        .returning();
      return created;
    }),

  updateService: protectedProcedure
    .input(serviceInputSchema.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnerBusiness(ctx.clerkUserId);
      await requireOwnedService(input.id, business.id);

      const [updated] = await db
        .update(tables.services)
        .set({
          name: input.name,
          description: input.description?.trim() || null,
          durationMinutes: input.durationMinutes,
          priceCents: input.priceAgorot,
        })
        .where(eq(tables.services.id, input.id))
        .returning();
      return updated;
    }),

  deleteService: protectedProcedure
    .input(serviceIdSchema)
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnerBusiness(ctx.clerkUserId);
      await requireOwnedService(input.id, business.id);

      await db.delete(tables.services).where(eq(tables.services.id, input.id));
      return { id: input.id };
    }),
});
