import { eq, and, asc, gte, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { DateTime } from "luxon";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { createAppointmentSchema } from "../schemas/booking";

/** "09:00:00" / "09:00" → minutes since midnight. */
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/** Loads public business fields (incl. booking window) by id, or throws NOT_FOUND. */
async function requireBusiness(businessId: string) {
  const [business] = await db
    .select({
      id: tables.businesses.id,
      timezone: tables.businesses.timezone,
      autoOpenCalendar: tables.businesses.autoOpenCalendar,
      autoOpenDays: tables.businesses.autoOpenDays,
      manualOpenUntil: tables.businesses.manualOpenUntil,
    })
    .from(tables.businesses)
    .where(eq(tables.businesses.id, businessId));

  if (!business) {
    throw new TRPCError({ code: "NOT_FOUND", message: "העסק לא נמצא." });
  }
  return business;
}

/**
 * Latest bookable date ("YYYY-MM-DD") in the business timezone. Auto mode rolls
 * forward `today + autoOpenDays`; manual mode hard-caps at `manualOpenUntil`
 * (never before today).
 */
function computeMaxBookingDate(
  business: {
    autoOpenCalendar: boolean;
    autoOpenDays: number;
    manualOpenUntil: string | null;
  },
  timezone: string,
): string {
  const today = DateTime.now().setZone(timezone).startOf("day");
  if (business.autoOpenCalendar) {
    return today.plus({ days: business.autoOpenDays }).toFormat("yyyy-MM-dd");
  }
  if (!business.manualOpenUntil) return today.toFormat("yyyy-MM-dd");
  const manual = DateTime.fromISO(business.manualOpenUntil, { zone: timezone });
  const max = manual < today ? today : manual;
  return max.toFormat("yyyy-MM-dd");
}

/**
 * Available start times for a business on a given date, respecting working
 * hours and existing (non-cancelled) appointments. Candidate starts step by the
 * service duration, and each slot blocks exactly `durationMinutes`. All
 * wall-clock math runs in the business timezone so DST is handled correctly.
 */
async function computeAvailableSlots(
  businessId: string,
  timezone: string,
  date: string,
  durationMinutes: number,
): Promise<string[]> {
  const dayStart = DateTime.fromISO(date, { zone: timezone }).startOf("day");
  if (!dayStart.isValid) return [];

  // Luxon weekday: 1=Mon..7=Sun → our schema: 0=Sun..6=Sat.
  const dayOfWeek = dayStart.weekday % 7;

  const [hours] = await db
    .select()
    .from(tables.workingHours)
    .where(
      and(
        eq(tables.workingHours.businessId, businessId),
        eq(tables.workingHours.dayOfWeek, dayOfWeek),
      ),
    );

  if (!hours || hours.isClosed) return [];

  const startMin = timeToMinutes(hours.startTime);
  const endMin = timeToMinutes(hours.endTime);

  // Existing appointments that fall on this calendar day (business tz).
  const dayEnd = dayStart.plus({ days: 1 });
  const existing = await db
    .select({
      startAt: tables.appointments.startAt,
      endAt: tables.appointments.endAt,
      status: tables.appointments.status,
    })
    .from(tables.appointments)
    .where(
      and(
        eq(tables.appointments.businessId, businessId),
        gte(tables.appointments.startAt, dayStart.toJSDate()),
        lt(tables.appointments.startAt, dayEnd.toJSDate()),
      ),
    );

  // Blocked periods (vacations / manual blocks) overlapping this day.
  const blocks = await db
    .select({
      startAt: tables.blockedPeriods.startAt,
      endAt: tables.blockedPeriods.endAt,
    })
    .from(tables.blockedPeriods)
    .where(
      and(
        eq(tables.blockedPeriods.businessId, businessId),
        lt(tables.blockedPeriods.startAt, dayEnd.toJSDate()),
        gt(tables.blockedPeriods.endAt, dayStart.toJSDate()),
      ),
    );

  // Busy intervals = active appointments + blocked periods.
  const busy = [
    ...existing
      .filter((appt) => appt.status !== "CANCELLED")
      .map((appt) => ({
        start: DateTime.fromJSDate(appt.startAt),
        end: DateTime.fromJSDate(appt.endAt),
      })),
    ...blocks.map((block) => ({
      start: DateTime.fromJSDate(block.startAt),
      end: DateTime.fromJSDate(block.endAt),
    })),
  ];

  const now = DateTime.now().setZone(timezone);
  const slots: string[] = [];

  for (
    let min = startMin;
    min + durationMinutes <= endMin;
    min += durationMinutes
  ) {
    const slotStart = dayStart.plus({ minutes: min });
    const slotEnd = slotStart.plus({ minutes: durationMinutes });

    if (slotStart < now) continue; // don't offer past times

    const overlaps = busy.some(
      (interval) => slotStart < interval.end && interval.start < slotEnd,
    );
    if (!overlaps) slots.push(slotStart.toFormat("HH:mm"));
  }

  return slots;
}

/**
 * Unauthenticated, read-only + booking endpoints for the public surface.
 * Returns only public-safe fields (no ownerId / internal bookkeeping).
 */
export const publicRouter = router({
  /** A business and its active services by public slug, or `null` if unknown. */
  getBusinessBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const [business] = await db
        .select({
          id: tables.businesses.id,
          name: tables.businesses.name,
          slug: tables.businesses.slug,
          description: tables.businesses.description,
          imageUrl: tables.businesses.imageUrl,
          phone: tables.businesses.phone,
          city: tables.businesses.city,
          address: tables.businesses.address,
          timezone: tables.businesses.timezone,
          autoOpenCalendar: tables.businesses.autoOpenCalendar,
          autoOpenDays: tables.businesses.autoOpenDays,
          manualOpenUntil: tables.businesses.manualOpenUntil,
        })
        .from(tables.businesses)
        .where(eq(tables.businesses.slug, input.slug));

      if (!business) return null;

      const maxBookingDate = computeMaxBookingDate(business, business.timezone);

      const services = await db
        .select({
          id: tables.services.id,
          name: tables.services.name,
          description: tables.services.description,
          durationMinutes: tables.services.durationMinutes,
          priceCents: tables.services.priceCents,
          currency: tables.services.currency,
        })
        .from(tables.services)
        .where(
          and(
            eq(tables.services.businessId, business.id),
            eq(tables.services.isActive, true),
          ),
        )
        .orderBy(asc(tables.services.createdAt));

      const {
        autoOpenCalendar: _a,
        autoOpenDays: _d,
        manualOpenUntil: _m,
        ...publicBusiness
      } = business;

      return {
        business: { ...publicBusiness, maxBookingDate },
        services,
      };
    }),

  /** Open start times for a service on a date ("YYYY-MM-DD"), per its duration. */
  getAvailableSlots: publicProcedure
    .input(
      z.object({
        businessId: z.string().uuid(),
        serviceId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ input }) => {
      const business = await requireBusiness(input.businessId);

      const [service] = await db
        .select({
          businessId: tables.services.businessId,
          durationMinutes: tables.services.durationMinutes,
          isActive: tables.services.isActive,
        })
        .from(tables.services)
        .where(eq(tables.services.id, input.serviceId));

      if (!service || service.businessId !== business.id || !service.isActive) {
        return [];
      }

      // Outside the booking window → no slots.
      if (input.date > computeMaxBookingDate(business, business.timezone)) {
        return [];
      }

      return computeAvailableSlots(
        business.id,
        business.timezone,
        input.date,
        service.durationMinutes,
      );
    }),

  /**
   * Books an appointment for the authenticated, onboarded client. Name + phone
   * come from the user's profile (not the request); guest bookings are disabled.
   */
  createAppointment: protectedProcedure
    .input(createAppointmentSchema)
    .mutation(async ({ ctx, input }) => {
      const business = await requireBusiness(input.businessId);

      const [user] = await db
        .select({
          id: tables.users.id,
          fullName: tables.users.fullName,
          phone: tables.users.phone,
        })
        .from(tables.users)
        .where(eq(tables.users.clerkUserId, ctx.clerkUserId));
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "המשתמש לא נמצא." });
      }
      // Onboarding is required before booking (name + phone on the profile).
      const fullName = user.fullName?.trim();
      const phone = user.phone?.trim();
      if (!fullName || !phone) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "יש להשלים את פרטי הפרופיל לפני קביעת תור.",
        });
      }
      const linkedUserId = user.id;

      const [service] = await db
        .select({
          id: tables.services.id,
          businessId: tables.services.businessId,
          priceCents: tables.services.priceCents,
          durationMinutes: tables.services.durationMinutes,
          isActive: tables.services.isActive,
          requiresApproval: tables.services.requiresApproval,
        })
        .from(tables.services)
        .where(eq(tables.services.id, input.serviceId));

      if (!service || service.businessId !== business.id || !service.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "השירות לא נמצא." });
      }

      // Enforce the booking window server-side.
      if (input.date > computeMaxBookingDate(business, business.timezone)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "התאריך שנבחר מחוץ לטווח ההזמנות.",
        });
      }

      const startAt = DateTime.fromISO(`${input.date}T${input.time}`, {
        zone: business.timezone,
      });
      if (!startAt.isValid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "מועד לא תקין." });
      }
      const endAt = startAt.plus({ minutes: service.durationMinutes });

      // Re-validate availability server-side (working hours + no overlap).
      const openSlots = await computeAvailableSlots(
        business.id,
        business.timezone,
        input.date,
        service.durationMinutes,
      );
      if (!openSlots.includes(input.time)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "המועד שנבחר אינו פנוי. נסו מועד אחר.",
        });
      }

      const appointment = await db.transaction(async (tx) => {
        // Upsert the per-business client contact from the user's profile,
        // keeping it linked to their account for the portal.
        const [client] = await tx
          .insert(tables.clients)
          .values({
            businessId: business.id,
            userId: linkedUserId,
            fullName,
            phone,
          })
          .onConflictDoUpdate({
            target: [tables.clients.businessId, tables.clients.phone],
            set: { fullName, userId: linkedUserId },
          })
          .returning();

        const [created] = await tx
          .insert(tables.appointments)
          .values({
            businessId: business.id,
            serviceId: service.id,
            clientId: client.id,
            startAt: startAt.toJSDate(),
            endAt: endAt.toJSDate(),
            // Auto-confirm unless the service requires manual owner approval.
            status: service.requiresApproval ? "PENDING" : "CONFIRMED",
            priceCentsSnapshot: service.priceCents,
          })
          .returning({ id: tables.appointments.id });

        return created;
      });

      return {
        id: appointment.id,
        date: input.date,
        time: input.time,
      };
    }),

  /** Appointment details for the SMS confirmation page (no auth, by id). */
  getAppointmentDetails: publicProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          id: tables.appointments.id,
          startAt: tables.appointments.startAt,
          endAt: tables.appointments.endAt,
          status: tables.appointments.status,
          priceCentsSnapshot: tables.appointments.priceCentsSnapshot,
          clientName: tables.clients.fullName,
          serviceName: tables.services.name,
          businessName: tables.businesses.name,
          timezone: tables.businesses.timezone,
        })
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
        .where(eq(tables.appointments.id, input.appointmentId));

      if (!row) return null;

      const start = DateTime.fromJSDate(row.startAt)
        .setZone(row.timezone)
        .setLocale("he");
      const end = DateTime.fromJSDate(row.endAt).setZone(row.timezone);

      return {
        id: row.id,
        status: row.status,
        clientName: row.clientName,
        serviceName: row.serviceName,
        businessName: row.businessName,
        priceCentsSnapshot: row.priceCentsSnapshot,
        date: start.toLocaleString({
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        startTime: start.toFormat("HH:mm"),
        endTime: end.toFormat("HH:mm"),
      };
    }),

  /**
   * Client-facing status update from the SMS link. Only allows the
   * PENDING → CONFIRMED / CANCELLED transition.
   */
  updateAppointmentStatusPublic: publicProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        status: z.enum(["CONFIRMED", "CANCELLED"]),
      }),
    )
    .mutation(async ({ input }) => {
      const [appointment] = await db
        .select({
          id: tables.appointments.id,
          status: tables.appointments.status,
        })
        .from(tables.appointments)
        .where(eq(tables.appointments.id, input.appointmentId));

      if (!appointment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "התור לא נמצא." });
      }
      if (appointment.status !== "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "התור כבר טופל ולא ניתן לעדכן אותו.",
        });
      }

      const [updated] = await db
        .update(tables.appointments)
        .set({ status: input.status })
        .where(eq(tables.appointments.id, input.appointmentId))
        .returning({
          id: tables.appointments.id,
          status: tables.appointments.status,
        });
      return updated;
    }),
});
