import { eq, and, asc, gte } from "drizzle-orm";
import { z } from "zod";
import { DateTime } from "luxon";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, protectedProcedure } from "../trpc";
import { createBlockedPeriodSchema } from "../schemas/block";

/** Resolves the authenticated owner's business, enforcing the OWNER role. */
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
      message: "רק בעלי עסק יכולים לנהל חסימות.",
    });
  }

  const [business] = await db
    .select()
    .from(tables.businesses)
    .where(eq(tables.businesses.ownerId, user.id));

  if (!business) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "צרו תחילה את פרטי העסק.",
    });
  }
  return business;
}

/** Builds a human label for a stored block, in the business timezone. */
function describeBlock(
  startAt: Date,
  endAt: Date,
  timezone: string,
): { dateLabel: string; timeLabel: string } {
  const start = DateTime.fromJSDate(startAt).setZone(timezone).setLocale("he");
  const end = DateTime.fromJSDate(endAt).setZone(timezone).setLocale("he");

  const fmtDate = (d: DateTime) =>
    d.toLocaleString({ weekday: "long", day: "numeric", month: "long" });

  // Whole-day block: starts at midnight and ends at a midnight.
  const isAllDay =
    start.hour === 0 &&
    start.minute === 0 &&
    end.hour === 0 &&
    end.minute === 0;

  if (isAllDay) {
    // endAt is exclusive midnight → last blocked day is end - 1 day.
    const lastDay = end.minus({ days: 1 });
    const sameDay = lastDay.hasSame(start, "day");
    return {
      dateLabel: sameDay
        ? fmtDate(start)
        : `${fmtDate(start)} – ${fmtDate(lastDay)}`,
      timeLabel: "כל היום",
    };
  }

  return {
    dateLabel: fmtDate(start),
    timeLabel: `${start.toFormat("HH:mm")}–${end.toFormat("HH:mm")}`,
  };
}

export const blocksRouter = router({
  /** Upcoming/ongoing blocks for the owner's business, ordered by start. */
  getBlockedPeriods: protectedProcedure.query(async ({ ctx }) => {
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

    const rows = await db
      .select({
        id: tables.blockedPeriods.id,
        startAt: tables.blockedPeriods.startAt,
        endAt: tables.blockedPeriods.endAt,
        reason: tables.blockedPeriods.reason,
      })
      .from(tables.blockedPeriods)
      .where(
        and(
          eq(tables.blockedPeriods.businessId, business.id),
          gte(tables.blockedPeriods.endAt, new Date()),
        ),
      )
      .orderBy(asc(tables.blockedPeriods.startAt));

    return rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      ...describeBlock(row.startAt, row.endAt, business.timezone),
    }));
  }),

  createBlockedPeriod: protectedProcedure
    .input(createBlockedPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnerBusiness(ctx.clerkUserId);
      const zone = business.timezone;

      let startAt: DateTime;
      let endAt: DateTime;

      if (input.allDay) {
        startAt = DateTime.fromISO(input.startDate, { zone }).startOf("day");
        const endDate = input.endDate || input.startDate;
        // End is exclusive: midnight after the last blocked day.
        endAt = DateTime.fromISO(endDate, { zone })
          .startOf("day")
          .plus({ days: 1 });
      } else {
        startAt = DateTime.fromISO(`${input.startDate}T${input.startTime}`, {
          zone,
        });
        endAt = DateTime.fromISO(`${input.startDate}T${input.endTime}`, {
          zone,
        });
      }

      if (!startAt.isValid || !endAt.isValid || endAt <= startAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "טווח לא תקין." });
      }

      const [created] = await db
        .insert(tables.blockedPeriods)
        .values({
          businessId: business.id,
          startAt: startAt.toJSDate(),
          endAt: endAt.toJSDate(),
          reason: input.reason?.trim() || null,
        })
        .returning({ id: tables.blockedPeriods.id });
      return created;
    }),

  deleteBlockedPeriod: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnerBusiness(ctx.clerkUserId);

      const [block] = await db
        .select({
          id: tables.blockedPeriods.id,
          businessId: tables.blockedPeriods.businessId,
        })
        .from(tables.blockedPeriods)
        .where(eq(tables.blockedPeriods.id, input.id));

      if (!block || block.businessId !== business.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "החסימה לא נמצאה." });
      }

      await db
        .delete(tables.blockedPeriods)
        .where(eq(tables.blockedPeriods.id, input.id));
      return { id: input.id };
    }),
});
