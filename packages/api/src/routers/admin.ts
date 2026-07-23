import { count, countDistinct, desc, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, tables } from "@spotz/db";
import { router, adminProcedure } from "../trpc";

/** All appointment statuses, so the breakdown always reports every key. */
const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
] as const;

type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
type StatusBreakdown = Record<AppointmentStatus, number>;

/** Fixed display timezone for admin date formatting (no per-business context). */
const ADMIN_TIMEZONE = "Asia/Jerusalem";

export const adminRouter = router({
  /**
   * Platform-wide overview for the private /admin route. Everything is computed
   * with SQL aggregation (count / group by) — no row-fetch-and-count in JS.
   */
  getOverview: adminProcedure.query(async () => {
    const [businessCountRows, userCountRows, statusRows, perBusinessRows] =
      await Promise.all([
        // Total businesses.
        db.select({ value: count() }).from(tables.businesses),
        // Total users.
        db.select({ value: count() }).from(tables.users),
        // Appointments per status → yields both the breakdown and the total.
        db
          .select({
            status: tables.appointments.status,
            value: count(),
          })
          .from(tables.appointments)
          .groupBy(tables.appointments.status),
        // Per-business volume. LEFT JOIN so businesses with no appointments
        // still appear with zero counts. "Client" = distinct booking contact
        // (clients row) for this business, i.e. distinct appointments.clientId.
        db
          .select({
            id: tables.businesses.id,
            name: tables.businesses.name,
            slug: tables.businesses.slug,
            createdAt: tables.businesses.createdAt,
            appointmentCount: count(tables.appointments.id),
            clientCount: countDistinct(tables.appointments.clientId),
          })
          .from(tables.businesses)
          .leftJoin(
            tables.appointments,
            eq(tables.appointments.businessId, tables.businesses.id),
          )
          .groupBy(tables.businesses.id)
          .orderBy(desc(count(tables.appointments.id))),
      ]);

    const appointmentsByStatus = APPOINTMENT_STATUSES.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as StatusBreakdown);
    for (const row of statusRows) {
      appointmentsByStatus[row.status] = Number(row.value);
    }
    const totalAppointments = Object.values(appointmentsByStatus).reduce(
      (sum, n) => sum + n,
      0,
    );

    return {
      totals: {
        businesses: Number(businessCountRows[0]?.value ?? 0),
        users: Number(userCountRows[0]?.value ?? 0),
        appointments: totalAppointments,
      },
      appointmentsByStatus,
      businesses: perBusinessRows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        clientCount: Number(row.clientCount),
        appointmentCount: Number(row.appointmentCount),
        createdDate: DateTime.fromJSDate(row.createdAt)
          .setZone(ADMIN_TIMEZONE)
          .setLocale("he")
          .toLocaleString({ day: "numeric", month: "long", year: "numeric" }),
      })),
    };
  }),
});
