import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { DateTime } from "luxon";
import { TRPCError } from "@trpc/server";
import { db, tables } from "@spotz/db";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  createReviewSchema,
  createBusinessReviewSchema,
  updateReviewVisibilitySchema,
} from "../schemas/review";

const businessIdInput = z.object({ businessId: z.string().uuid() });

export const reviewsRouter = router({
  /**
   * Create a review for the signed-in client's own COMPLETED appointment.
   * One review per appointment (enforced by the unique constraint).
   */
  createReview: protectedProcedure
    .input(createReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select({ id: tables.users.id })
        .from(tables.users)
        .where(eq(tables.users.clerkUserId, ctx.clerkUserId));
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "המשתמש לא נמצא." });
      }

      const [appt] = await db
        .select({
          id: tables.appointments.id,
          businessId: tables.appointments.businessId,
          clientId: tables.appointments.clientId,
          status: tables.appointments.status,
          ownerUserId: tables.clients.userId,
        })
        .from(tables.appointments)
        .innerJoin(
          tables.clients,
          eq(tables.appointments.clientId, tables.clients.id),
        )
        .where(eq(tables.appointments.id, input.appointmentId));

      // Must exist and belong to the signed-in client.
      if (!appt || appt.ownerUserId !== user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "התור לא נמצא." });
      }
      if (appt.status !== "COMPLETED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "ניתן להוסיף חוות דעת רק לאחר שהתור הושלם.",
        });
      }

      const [created] = await db
        .insert(tables.reviews)
        .values({
          businessId: appt.businessId,
          appointmentId: appt.id,
          clientId: appt.clientId,
          rating: input.rating,
          comment: input.comment?.trim() || null,
        })
        .onConflictDoNothing({ target: tables.reviews.appointmentId })
        .returning({ id: tables.reviews.id });

      if (!created) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "כבר הוספת חוות דעת לתור זה.",
        });
      }
      return { id: created.id };
    }),

  /**
   * Direct public review for a business — no appointment required. Works for
   * signed-in users (defaults to their local name) and guests (must supply
   * `reviewerName`).
   */
  createBusinessReview: publicProcedure
    .input(createBusinessReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const [business] = await db
        .select({ id: tables.businesses.id })
        .from(tables.businesses)
        .where(eq(tables.businesses.id, input.businessId));
      if (!business) {
        throw new TRPCError({ code: "NOT_FOUND", message: "העסק לא נמצא." });
      }

      // Resolve the display name: explicit input wins, else the signed-in
      // user's local name. Guests without a name are rejected.
      let reviewerName = input.reviewerName?.trim() || null;
      if (!reviewerName && ctx.clerkUserId) {
        const [user] = await db
          .select({ fullName: tables.users.fullName })
          .from(tables.users)
          .where(eq(tables.users.clerkUserId, ctx.clerkUserId));
        reviewerName = user?.fullName?.trim() || null;
      }
      if (!reviewerName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "יש להזין שם." });
      }

      const [created] = await db
        .insert(tables.reviews)
        .values({
          businessId: business.id,
          appointmentId: null,
          clientId: null,
          rating: input.rating,
          comment: input.comment?.trim() || null,
          reviewerName,
        })
        .returning({ id: tables.reviews.id });
      return { id: created.id };
    }),

  /** Visible reviews for a business, newest first (public). */
  getBusinessReviews: publicProcedure
    .input(businessIdInput)
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: tables.reviews.id,
          rating: tables.reviews.rating,
          comment: tables.reviews.comment,
          createdAt: tables.reviews.createdAt,
          reviewerName: tables.reviews.reviewerName,
          clientName: tables.clients.fullName,
          timezone: tables.businesses.timezone,
        })
        .from(tables.reviews)
        // Left join: direct reviews have no client row.
        .leftJoin(
          tables.clients,
          eq(tables.reviews.clientId, tables.clients.id),
        )
        .innerJoin(
          tables.businesses,
          eq(tables.reviews.businessId, tables.businesses.id),
        )
        .where(
          and(
            eq(tables.reviews.businessId, input.businessId),
            eq(tables.reviews.isVisible, true),
          ),
        )
        .orderBy(desc(tables.reviews.createdAt));

      return rows.map((row) => ({
        id: row.id,
        // Direct review name, else the linked client's name, else a fallback.
        reviewerName: row.reviewerName ?? row.clientName ?? "לקוח",
        rating: row.rating,
        comment: row.comment,
        date: DateTime.fromJSDate(row.createdAt)
          .setZone(row.timezone)
          .setLocale("he")
          .toLocaleString({ day: "numeric", month: "long", year: "numeric" }),
      }));
    }),

  /** Average rating + count over visible reviews (public). */
  getBusinessRatingSummary: publicProcedure
    .input(businessIdInput)
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          avg: sql<number>`coalesce(avg(${tables.reviews.rating}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(tables.reviews)
        .where(
          and(
            eq(tables.reviews.businessId, input.businessId),
            eq(tables.reviews.isVisible, true),
          ),
        );

      const reviewCount = Number(row?.count ?? 0);
      const averageRating =
        reviewCount > 0 ? Math.round(Number(row?.avg ?? 0) * 10) / 10 : 0;
      return { averageRating, reviewCount };
    }),

  /** Owner-only: hide/show one of their business's reviews. */
  updateReviewVisibility: protectedProcedure
    .input(updateReviewVisibilitySchema)
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select({ id: tables.users.id, role: tables.users.role })
        .from(tables.users)
        .where(eq(tables.users.clerkUserId, ctx.clerkUserId));
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "המשתמש לא נמצא." });
      }
      if (user.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "רק בעל העסק יכול לנהל חוות דעת.",
        });
      }

      const [review] = await db
        .select({
          id: tables.reviews.id,
          ownerId: tables.businesses.ownerId,
        })
        .from(tables.reviews)
        .innerJoin(
          tables.businesses,
          eq(tables.reviews.businessId, tables.businesses.id),
        )
        .where(eq(tables.reviews.id, input.reviewId));

      if (!review || review.ownerId !== user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "חוות הדעת לא נמצאה.",
        });
      }

      await db
        .update(tables.reviews)
        .set({ isVisible: input.isVisible, updatedAt: new Date() })
        .where(eq(tables.reviews.id, input.reviewId));
      return { id: input.reviewId, isVisible: input.isVisible };
    }),
});
