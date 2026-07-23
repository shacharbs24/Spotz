import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, protectedProcedure } from "../trpc";
import { businessInputSchema } from "../schemas/business";

/** Resolves the local `users` row for the authenticated Clerk user. */
async function requireUser(clerkUserId: string) {
  const [user] = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.clerkUserId, clerkUserId));

  if (!user) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "המשתמש לא נמצא. נסו להתחבר מחדש.",
    });
  }
  return user;
}

export const businessesRouter = router({
  /** The business owned by the current user, or `null` if none yet. */
  getMyBusiness: protectedProcedure.query(async ({ ctx }) => {
    // ctx.user is loaded once per request in createClerkContext — no re-query.
    const user = ctx.user;
    if (!user) return null;

    const [business] = await db
      .select()
      .from(tables.businesses)
      .where(eq(tables.businesses.ownerId, user.id));

    return business ?? null;
  }),

  /** Create or update the current owner's business. */
  upsertBusiness: protectedProcedure
    .input(businessInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await requireUser(ctx.clerkUserId);

      // Server-side authorization gate — role intent from sign-up is not trusted
      // on its own, so owner-only writes are enforced here.
      if (user.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "רק בעלי עסק יכולים לנהל עסק.",
        });
      }

      // Reject a slug already taken by a different owner (friendly error before
      // hitting the DB unique constraint).
      const [slugHolder] = await db
        .select({
          id: tables.businesses.id,
          ownerId: tables.businesses.ownerId,
        })
        .from(tables.businesses)
        .where(eq(tables.businesses.slug, input.slug));

      if (slugHolder && slugHolder.ownerId !== user.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "הכתובת הזו כבר תפוסה. בחרו כתובת אחרת.",
        });
      }

      // Normalize optional free-text fields: empty → null.
      const city = input.city?.trim() || null;
      const address = input.address?.trim() || null;
      const description = input.description?.trim() || null;
      const imageUrl = input.imageUrl?.trim() || null;
      const manualOpenUntil = input.autoOpenCalendar
        ? null
        : input.manualOpenUntil?.trim() || null;

      const [existing] = await db
        .select()
        .from(tables.businesses)
        .where(eq(tables.businesses.ownerId, user.id));

      if (existing) {
        const [updated] = await db
          .update(tables.businesses)
          .set({
            name: input.name,
            slug: input.slug,
            timezone: input.timezone,
            description,
            imageUrl,
            city,
            address,
            autoOpenCalendar: input.autoOpenCalendar,
            autoOpenDays: input.autoOpenDays,
            manualOpenUntil,
          })
          .where(eq(tables.businesses.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(tables.businesses)
        .values({
          ownerId: user.id,
          name: input.name,
          slug: input.slug,
          timezone: input.timezone,
          description,
          imageUrl,
          city,
          address,
          autoOpenCalendar: input.autoOpenCalendar,
          autoOpenDays: input.autoOpenDays,
          manualOpenUntil,
        })
        .returning();
      return created;
    }),
});
