import { eq, and, asc, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { DateTime } from "luxon";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, protectedProcedure } from "../trpc";
import { updateAppointmentStatusSchema } from "../schemas/appointment";

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
      message: "רק בעלי עסק יכולים לנהל תורים.",
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

export const appointmentsRouter = router({
  /**
   * Appointments for the owner's business on a specific date ("YYYY-MM-DD"),
   * joined with client + service, ordered by start time ascending. Date/time are
   * formatted server-side in the business timezone so the client renders strings.
   */
  getDashboardAppointments: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
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

      // Day bounds in the business timezone.
      const dayStart = DateTime.fromISO(input.date, {
        zone: business.timezone,
      }).startOf("day");
      const dayEnd = dayStart.plus({ days: 1 });

      const rows = await db
        .select({
          id: tables.appointments.id,
          startAt: tables.appointments.startAt,
          endAt: tables.appointments.endAt,
          status: tables.appointments.status,
          priceCentsSnapshot: tables.appointments.priceCentsSnapshot,
          clientName: tables.clients.fullName,
          clientPhone: tables.clients.phone,
          serviceName: tables.services.name,
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
        .where(
          and(
            eq(tables.appointments.businessId, business.id),
            gte(tables.appointments.startAt, dayStart.toJSDate()),
            lt(tables.appointments.startAt, dayEnd.toJSDate()),
          ),
        )
        .orderBy(asc(tables.appointments.startAt));

    const now = DateTime.now().setZone(business.timezone).toMillis();

    return rows.map((row) => {
      const start = DateTime.fromJSDate(row.startAt)
        .setZone(business.timezone)
        .setLocale("he");
      const end = DateTime.fromJSDate(row.endAt).setZone(business.timezone);

      return {
        id: row.id,
        status: row.status,
        priceCentsSnapshot: row.priceCentsSnapshot,
        clientName: row.clientName,
        clientPhone: row.clientPhone,
        serviceName: row.serviceName,
        date: start.toLocaleString({
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        startTime: start.toFormat("HH:mm"),
        endTime: end.toFormat("HH:mm"),
        // Elapsed once the appointment's end time has passed — used to keep past
        // items out of the dashboard's "today" widget.
        isPast: end.toMillis() < now,
      };
    });
  }),

  /** Changes an appointment's status (owner of the appointment's business only). */
  updateAppointmentStatus: protectedProcedure
    .input(updateAppointmentStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnerBusiness(ctx.clerkUserId);

      const [appointment] = await db
        .select({
          id: tables.appointments.id,
          businessId: tables.appointments.businessId,
        })
        .from(tables.appointments)
        .where(eq(tables.appointments.id, input.id));

      if (!appointment || appointment.businessId !== business.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "התור לא נמצא." });
      }

      const [updated] = await db
        .update(tables.appointments)
        .set({ status: input.status })
        .where(eq(tables.appointments.id, input.id))
        .returning({
          id: tables.appointments.id,
          status: tables.appointments.status,
        });
      return updated;
    }),
});
