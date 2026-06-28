import { eq, and, asc, desc, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { DateTime } from "luxon";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, protectedProcedure } from "../trpc";
import { updateProfileSchema } from "../schemas/profile";

const PAST_PAGE_SIZE = 10;

/** Clients may not self-cancel within this many hours of the appointment. */
const CANCELLATION_WINDOW_HOURS = 24;

/** Shared select shape for a client's appointment row (joined). */
const appointmentSelect = {
  id: tables.appointments.id,
  startAt: tables.appointments.startAt,
  endAt: tables.appointments.endAt,
  status: tables.appointments.status,
  priceCentsSnapshot: tables.appointments.priceCentsSnapshot,
  serviceName: tables.services.name,
  businessName: tables.businesses.name,
  businessPhone: tables.businesses.phone,
  timezone: tables.businesses.timezone,
  reviewId: tables.reviews.id, // left-joined → null when not reviewed
} as const;

/** Resolves the local user row for the authenticated Clerk user, or throws. */
async function requireUser(clerkUserId: string) {
  const [user] = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.clerkUserId, clerkUserId));
  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "המשתמש לא נמצא." });
  }
  return user;
}

export const meRouter = router({
  /** Current user's role + name + phone (used to branch the home page and
   * pre-fill the booking form). */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({
        role: tables.users.role,
        fullName: tables.users.fullName,
        phone: tables.users.phone,
      })
      .from(tables.users)
      .where(eq(tables.users.clerkUserId, ctx.clerkUserId));
    return user ?? { role: "CLIENT" as const, fullName: null, phone: null };
  }),

  /** Save onboarding details (name + phone) to the signed-in user's profile. */
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(tables.users)
        .set({ fullName: input.fullName.trim(), phone: input.phone.trim() })
        .where(eq(tables.users.clerkUserId, ctx.clerkUserId))
        .returning({ id: tables.users.id });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "המשתמש לא נמצא." });
      }
      return { success: true };
    }),

  /** The signed-in client's upcoming appointments (chronological). */
  getMyAppointments: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({ id: tables.users.id })
      .from(tables.users)
      .where(eq(tables.users.clerkUserId, ctx.clerkUserId));
    if (!user) return { upcoming: [] };

    const rows = await db
      .select(appointmentSelect)
      .from(tables.appointments)
      .innerJoin(
        tables.clients,
        eq(tables.appointments.clientId, tables.clients.id),
      )
      .innerJoin(
        tables.services,
        eq(tables.appointments.serviceId, tables.services.id),
      )
      .innerJoin(
        tables.businesses,
        eq(tables.appointments.businessId, tables.businesses.id),
      )
      .leftJoin(
        tables.reviews,
        eq(tables.appointments.id, tables.reviews.appointmentId),
      )
      .where(
        and(
          eq(tables.clients.userId, user.id),
          gte(tables.appointments.endAt, new Date()),
        ),
      )
      .orderBy(asc(tables.appointments.startAt));

    return { upcoming: rows.map(formatRow) };
  }),

  /**
   * The client's past appointments, newest first, paginated via an offset
   * cursor (page size 10). `nextCursor` is null when there are no more.
   */
  getMyPastAppointments: protectedProcedure
    .input(z.object({ cursor: z.number().int().min(0).nullish() }))
    .query(async ({ ctx, input }) => {
      const offset = input.cursor ?? 0;

      const [user] = await db
        .select({ id: tables.users.id })
        .from(tables.users)
        .where(eq(tables.users.clerkUserId, ctx.clerkUserId));
      if (!user) return { items: [], nextCursor: null };

      const rows = await db
        .select(appointmentSelect)
        .from(tables.appointments)
        .innerJoin(
          tables.clients,
          eq(tables.appointments.clientId, tables.clients.id),
        )
        .innerJoin(
          tables.services,
          eq(tables.appointments.serviceId, tables.services.id),
        )
        .innerJoin(
          tables.businesses,
          eq(tables.appointments.businessId, tables.businesses.id),
        )
        .leftJoin(
          tables.reviews,
          eq(tables.appointments.id, tables.reviews.appointmentId),
        )
        .where(
          and(
            eq(tables.clients.userId, user.id),
            lt(tables.appointments.endAt, new Date()),
          ),
        )
        .orderBy(desc(tables.appointments.startAt))
        .limit(PAST_PAGE_SIZE + 1)
        .offset(offset);

      const hasMore = rows.length > PAST_PAGE_SIZE;
      const page = hasMore ? rows.slice(0, PAST_PAGE_SIZE) : rows;

      return {
        items: page.map(formatRow),
        nextCursor: hasMore ? offset + PAST_PAGE_SIZE : null,
      };
    }),

  /** Distinct businesses where the signed-in client has at least one appointment. */
  getMyBusinesses: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({ id: tables.users.id })
      .from(tables.users)
      .where(eq(tables.users.clerkUserId, ctx.clerkUserId));
    if (!user) return [];

    return db
      .selectDistinct({
        id: tables.businesses.id,
        name: tables.businesses.name,
        slug: tables.businesses.slug,
        imageUrl: tables.businesses.imageUrl,
      })
      .from(tables.appointments)
      .innerJoin(
        tables.clients,
        eq(tables.appointments.clientId, tables.clients.id),
      )
      .innerJoin(
        tables.businesses,
        eq(tables.appointments.businessId, tables.businesses.id),
      )
      .where(eq(tables.clients.userId, user.id))
      .orderBy(asc(tables.businesses.name));
  }),

  /** Cancels one of the signed-in client's own appointments. */
  cancelMyAppointment: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const user = await requireUser(ctx.clerkUserId);

      const [appt] = await db
        .select({
          id: tables.appointments.id,
          status: tables.appointments.status,
          startAt: tables.appointments.startAt,
          ownerUserId: tables.clients.userId,
        })
        .from(tables.appointments)
        .innerJoin(
          tables.clients,
          eq(tables.appointments.clientId, tables.clients.id),
        )
        .where(eq(tables.appointments.id, input.id));

      if (!appt || appt.ownerUserId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "התור לא נמצא." });
      }
      if (appt.status !== "PENDING" && appt.status !== "CONFIRMED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "לא ניתן לבטל את התור הזה.",
        });
      }
      // 24h policy: block self-cancellation too close to the appointment.
      const hoursUntil =
        (appt.startAt.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < CANCELLATION_WINDOW_HOURS) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "לא ניתן לבטל תור פחות מ-24 שעות מראש. יש ליצור קשר עם בית העסק בטלפון.",
        });
      }

      await db
        .update(tables.appointments)
        .set({ status: "CANCELLED" })
        .where(eq(tables.appointments.id, input.id));
      return { id: input.id, status: "CANCELLED" as const };
    }),
});

function formatRow(row: {
  id: string;
  startAt: Date;
  endAt: Date;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  priceCentsSnapshot: number;
  serviceName: string;
  businessName: string;
  businessPhone: string | null;
  timezone: string;
  reviewId: string | null;
}) {
  const start = DateTime.fromJSDate(row.startAt)
    .setZone(row.timezone)
    .setLocale("he");
  const end = DateTime.fromJSDate(row.endAt).setZone(row.timezone);
  const hoursUntil = (row.startAt.getTime() - Date.now()) / (1000 * 60 * 60);
  return {
    id: row.id,
    status: row.status,
    priceCentsSnapshot: row.priceCentsSnapshot,
    serviceName: row.serviceName,
    businessName: row.businessName,
    businessPhone: row.businessPhone,
    // Within the cancellation window → client must call the business instead.
    isWithin24h: hoursUntil < CANCELLATION_WINDOW_HOURS,
    hasReview: row.reviewId !== null,
    date: start.toLocaleString({
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    startTime: start.toFormat("HH:mm"),
    endTime: end.toFormat("HH:mm"),
  };
}
