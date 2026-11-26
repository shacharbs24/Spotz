import { and, asc, count, countDistinct, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { db, tables } from "@spotz/db";
import { router, adminProcedure } from "../trpc";
import { normalizeIsraeliPhone } from "../lib/phone";
import { getOwnerApprovalContactPhone } from "../services/owner-approval";

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
  getOwnerApprovals: adminProcedure.query(async () => {
    const { users, businesses } = tables;
    const [contactPhone, owners] = await Promise.all([
      getOwnerApprovalContactPhone(),
      db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          businessName: businesses.name,
          registeredAt: users.createdAt,
          accessGranted: users.ownerAccessGranted,
          approvedAt: users.ownerApprovedAt,
        })
        .from(users)
        .leftJoin(businesses, eq(businesses.ownerId, users.id))
        .where(eq(users.role, "OWNER"))
        .orderBy(
          asc(users.ownerAccessGranted),
          sql`${users.ownerApprovedAt} desc nulls last`,
          desc(users.createdAt),
          asc(users.id),
        ),
    ]);

    return {
      contactPhone,
      owners: owners.map((owner) => ({
        ...owner,
        registeredAt: owner.registeredAt.toISOString(),
        approvedAt: owner.approvedAt?.toISOString() ?? null,
      })),
    };
  }),

  approveOwner: adminProcedure
    .input(z.object({ ownerId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { users } = tables;
      const owner = and(eq(users.id, input.ownerId), eq(users.role, "OWNER"));
      // Preserve the first approval timestamp when a click is retried.
      const [approved] = await db
        .update(users)
        .set({ ownerAccessGranted: true, ownerApprovedAt: sql`now()` })
        .where(and(owner, eq(users.ownerAccessGranted, false)))
        .returning({ approvedAt: users.ownerApprovedAt });
      if (approved?.approvedAt) {
        return { approvedAt: approved.approvedAt.toISOString() };
      }

      const [existing] = await db
        .select({ approvedAt: users.ownerApprovedAt })
        .from(users)
        .where(owner);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "חשבון בעל העסק לא נמצא.",
        });
      }
      return { approvedAt: existing.approvedAt?.toISOString() ?? null };
    }),

  setOwnerApprovalContact: adminProcedure
    .input(
      z.object({
        phone: z
          .string()
          .trim()
          .max(32)
          .regex(/^[+\d(). -]+$/, "הזינו מספר טלפון תקין."),
      }),
    )
    .mutation(async ({ input }) => {
      const contactPhone = normalizeIsraeliPhone(input.phone);
      if (!contactPhone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "הזינו מספר טלפון ישראלי תקין.",
        });
      }
      await db
        .insert(tables.ownerApprovalSettings)
        .values({ id: 1, contactPhone })
        .onConflictDoUpdate({
          target: tables.ownerApprovalSettings.id,
          set: { contactPhone },
        });
      return { contactPhone };
    }),

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
