import { eq, and, asc, gte, isNull } from "drizzle-orm";
import { z } from "zod";
import { DateTime } from "luxon";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, approvedOwnerProcedure } from "../trpc";
import { createBlockedPeriodSchema } from "../schemas/block";
import { staffAtBusiness } from "../services/staff-calendars";

const staffScope = z.object({ staffMemberId: z.string().uuid().optional() });

function blocksForCalendar(
  businessId: string,
  staffMemberId: string | undefined,
) {
  return and(
    eq(tables.blockedPeriods.businessId, businessId),
    staffMemberId
      ? eq(tables.blockedPeriods.staffMemberId, staffMemberId)
      : isNull(tables.blockedPeriods.staffMemberId),
  );
}

async function lockCalendar(
  tx: Pick<typeof db, "select">,
  businessId: string,
  staffMemberId: string | undefined,
) {
  const [calendar] = staffMemberId
    ? await tx
        .select({ id: tables.staffMembers.id })
        .from(tables.staffMembers)
        .where(staffAtBusiness(businessId, staffMemberId))
        .for("no key update")
    : await tx
        .select({ id: tables.businesses.id })
        .from(tables.businesses)
        .where(eq(tables.businesses.id, businessId))
        .for("no key update");
  if (!calendar)
    throw new TRPCError({ code: "NOT_FOUND", message: "היומן לא נמצא." });
}

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
  getBlockedPeriods: approvedOwnerProcedure
    .input(staffScope.optional())
    .query(async ({ ctx, input }) => {
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
            blocksForCalendar(business.id, input?.staffMemberId),
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

  createBlockedPeriod: approvedOwnerProcedure
    .input(createBlockedPeriodSchema.and(staffScope))
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

      return db.transaction(async (tx) => {
        await lockCalendar(tx, business.id, input.staffMemberId);
        const [created] = await tx
          .insert(tables.blockedPeriods)
          .values({
            businessId: business.id,
            staffMemberId: input.staffMemberId,
            startAt: startAt.toJSDate(),
            endAt: endAt.toJSDate(),
            reason: input.reason?.trim() || null,
          })
          .returning({ id: tables.blockedPeriods.id });
        return created;
      });
    }),

  deleteBlockedPeriod: approvedOwnerProcedure
    .input(staffScope.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnerBusiness(ctx.clerkUserId);

      return db.transaction(async (tx) => {
        await lockCalendar(tx, business.id, input.staffMemberId);
        const [block] = await tx
          .delete(tables.blockedPeriods)
          .where(
            and(
              blocksForCalendar(business.id, input.staffMemberId),
              eq(tables.blockedPeriods.id, input.id),
            ),
          )
          .returning({ id: tables.blockedPeriods.id });
        if (!block)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "החסימה לא נמצאה.",
          });
        return block;
      });
    }),
});
