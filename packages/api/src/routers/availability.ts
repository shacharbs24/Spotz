import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, protectedProcedure } from "../trpc";
import {
  updateAvailabilitySchema,
  type AvailabilityDay,
} from "../schemas/availability";

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

/** Default week: Sun–Thu (0–4) open 09:00–18:00, Fri/Sat (5–6) closed. */
function buildDefaultWeek(): AvailabilityDay[] {
  return Array.from({ length: 7 }, (_unused, dayOfWeek) => ({
    dayOfWeek,
    startTime: DEFAULT_START,
    endTime: DEFAULT_END,
    isClosed: dayOfWeek === 5 || dayOfWeek === 6,
    breaks: [],
  }));
}

export const availabilityRouter = router({
  /**
   * The owner's weekly schedule as a full 7-day array. Falls back to the
   * default week when the user has no business or hasn't set hours yet, so the
   * UI always has values to render.
   */
  getOurAvailability: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.clerkUserId, ctx.clerkUserId));

    if (!user || user.role !== "OWNER") return buildDefaultWeek();

    const [business] = await db
      .select()
      .from(tables.businesses)
      .where(eq(tables.businesses.ownerId, user.id));

    if (!business) return buildDefaultWeek();

    const rows = await db
      .select()
      .from(tables.workingHours)
      .where(eq(tables.workingHours.businessId, business.id));

    if (rows.length === 0) return buildDefaultWeek();

    // Merge stored rows onto a full default week so every day is present.
    const week = buildDefaultWeek();
    for (const row of rows) {
      if (row.dayOfWeek < 0 || row.dayOfWeek > 6) continue;
      week[row.dayOfWeek] = {
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime.slice(0, 5), // "09:00:00" → "09:00"
        endTime: row.endTime.slice(0, 5),
        isClosed: row.isClosed,
        breaks: row.breaks ?? [],
      };
    }
    return week;
  }),

  /** Replace the owner's weekly schedule with the provided days. */
  updateAvailability: protectedProcedure
    .input(updateAvailabilitySchema)
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select()
        .from(tables.users)
        .where(eq(tables.users.clerkUserId, ctx.clerkUserId));

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "המשתמש לא נמצא." });
      }
      if (user.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "רק בעלי עסק יכולים להגדיר שעות פעילות.",
        });
      }

      const [business] = await db
        .select()
        .from(tables.businesses)
        .where(eq(tables.businesses.ownerId, user.id));

      if (!business) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "צרו תחילה את פרטי העסק לפני הגדרת שעות הפעילות.",
        });
      }

      // Replace the whole week atomically.
      await db.transaction(async (tx) => {
        await tx
          .delete(tables.workingHours)
          .where(eq(tables.workingHours.businessId, business.id));

        await tx.insert(tables.workingHours).values(
          input.days.map((day) => ({
            businessId: business.id,
            dayOfWeek: day.dayOfWeek,
            startTime: day.startTime,
            endTime: day.endTime,
            isClosed: day.isClosed,
            breaks: day.breaks,
          })),
        );
      });

      return { success: true };
    }),
});
