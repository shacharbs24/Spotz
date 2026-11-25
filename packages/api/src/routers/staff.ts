import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, tables } from "@spotz/db";
import { protectedProcedure, router, type AuthUser } from "../trpc";
import { getBookingOwnerName } from "../lib/booking-owner-name";
import { hasDatabaseErrorCode } from "../lib/database-errors";
import {
  availabilityDaySchema,
  type AvailabilityDay,
} from "../schemas/availability";
import { staffAtBusiness, staffServiceIds } from "../services/staff-calendars";

const nameSchema = z
  .string()
  .trim()
  .min(2, "הזינו לפחות שני תווים.")
  .max(80, "השם יכול להכיל עד 80 תווים.");

const selectMember = {
  id: tables.staffMembers.id,
  name: tables.staffMembers.name,
};

const memberInput = z.object({ memberId: z.string().uuid() });
const weeklyHoursInput = z
  .array(availabilityDaySchema)
  .length(7)
  .refine(
    (days) => new Set(days.map((day) => day.dayOfWeek)).size === 7,
    "יש להגדיר כל יום בשבוע פעם אחת.",
  );

function missingMember() {
  return new TRPCError({
    code: "NOT_FOUND",
    message: "איש הצוות לא נמצא בעסק.",
  });
}

function nameTaken() {
  return new TRPCError({
    code: "CONFLICT",
    message: "השם הזה כבר מופיע ברשימת הצוות.",
  });
}

async function getOwnedBusiness(user: AuthUser | null) {
  if (user?.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ניהול צוות זמין לבעלי העסק בלבד.",
    });
  }

  const [business] = await db
    .select({
      id: tables.businesses.id,
      name: tables.businesses.name,
      ownerBookingName: tables.businesses.ownerBookingName,
    })
    .from(tables.businesses)
    .where(eq(tables.businesses.ownerId, user.id));
  return business;
}

async function requireOwnedBusiness(user: AuthUser | null) {
  const business = await getOwnedBusiness(user);
  if (!business) {
    throw new TRPCError({ code: "NOT_FOUND", message: "העסק לא נמצא." });
  }
  return business;
}

export const staffRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const business = await getOwnedBusiness(ctx.user);
    if (!business) {
      return {
        hasBusiness: false as const,
        members: [],
        ownerBookingName: null,
      };
    }

    const members = await db
      .select(selectMember)
      .from(tables.staffMembers)
      .where(eq(tables.staffMembers.businessId, business.id))
      .orderBy(asc(tables.staffMembers.createdAt), asc(tables.staffMembers.id));
    return {
      hasBusiness: true as const,
      members,
      ownerBookingName: getBookingOwnerName(business, ctx.user?.fullName),
    };
  }),

  getSettings: protectedProcedure
    .input(memberInput)
    .query(async ({ ctx, input }) => {
      const business = await requireOwnedBusiness(ctx.user);
      const [member] = await db
        .select({
          ...selectMember,
          weeklyHours: tables.staffMembers.weeklyHours,
          serviceIds: staffServiceIds,
        })
        .from(tables.staffMembers)
        .where(staffAtBusiness(business.id, input.memberId));
      if (!member) throw missingMember();

      const [storedHours, activeServices] = await Promise.all([
        db
          .select()
          .from(tables.workingHours)
          .where(eq(tables.workingHours.businessId, business.id)),
        db
          .select({ id: tables.services.id, name: tables.services.name })
          .from(tables.services)
          .where(
            and(
              eq(tables.services.businessId, business.id),
              eq(tables.services.isActive, true),
            ),
          )
          .orderBy(asc(tables.services.createdAt), asc(tables.services.id)),
      ]);
      const byDay = new Map(storedHours.map((day) => [day.dayOfWeek, day]));
      const businessWeek: AvailabilityDay[] = Array.from(
        { length: 7 },
        (_, dayOfWeek) => {
          const day = byDay.get(dayOfWeek);
          return {
            dayOfWeek,
            startTime: day?.startTime.slice(0, 5) ?? "09:00",
            endTime: day?.endTime.slice(0, 5) ?? "18:00",
            isClosed: day?.isClosed ?? true,
            breaks: day?.breaks ?? [],
          };
        },
      );

      return { ...member, businessWeek, activeServices };
    }),

  setWeeklyHours: protectedProcedure
    .input(memberInput.extend({ days: weeklyHoursInput.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnedBusiness(ctx.user);
      const [member] = await db
        .update(tables.staffMembers)
        .set({ weeklyHours: input.days })
        .where(staffAtBusiness(business.id, input.memberId))
        .returning({ id: tables.staffMembers.id });
      if (!member) throw missingMember();
      return { days: input.days };
    }),

  setServices: protectedProcedure
    .input(
      memberInput.extend({ serviceIds: z.array(z.string().uuid()).nullable() }),
    )
    .mutation(async ({ ctx, input }) => {
      const business = await requireOwnedBusiness(ctx.user);
      const serviceIds =
        input.serviceIds === null ? null : [...new Set(input.serviceIds)];
      await db.transaction(async (tx) => {
        // Update the member first so booking and other edits see one complete assignment.
        const [member] = await tx
          .update(tables.staffMembers)
          .set({ usesAllServices: serviceIds === null })
          .where(staffAtBusiness(business.id, input.memberId))
          .returning({ id: tables.staffMembers.id });
        if (!member) throw missingMember();

        if (serviceIds?.length) {
          const owned = await tx
            .select({ id: tables.services.id })
            .from(tables.services)
            .where(
              and(
                eq(tables.services.businessId, business.id),
                eq(tables.services.isActive, true),
                inArray(tables.services.id, serviceIds),
              ),
            )
            .for("share");
          if (owned.length !== serviceIds.length) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "רשימת השירותים השתנתה. רעננו ובחרו שוב.",
            });
          }
        }

        await tx
          .delete(tables.staffServices)
          .where(
            and(
              eq(tables.staffServices.businessId, business.id),
              eq(tables.staffServices.staffMemberId, member.id),
            ),
          );
        if (serviceIds?.length) {
          await tx.insert(tables.staffServices).values(
            serviceIds.map((serviceId) => ({
              businessId: business.id,
              staffMemberId: member.id,
              serviceId,
            })),
          );
        }
      });
      return { serviceIds };
    }),

  create: protectedProcedure
    .input(z.object({ name: nameSchema }))
    .mutation(async ({ ctx, input }) => {
      const business = await getOwnedBusiness(ctx.user);
      if (!business) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "הגדירו את פרטי העסק לפני הוספת צוות.",
        });
      }

      const [member] = await db
        .insert(tables.staffMembers)
        .values({ businessId: business.id, name: input.name })
        .onConflictDoNothing()
        .returning(selectMember);
      if (!member) throw nameTaken();
      return member;
    }),

  rename: protectedProcedure
    .input(
      z.object({ memberId: z.string().uuid().nullable(), name: nameSchema }),
    )
    .mutation(async ({ ctx, input }) => {
      const business = await getOwnedBusiness(ctx.user);
      if (!business) {
        throw new TRPCError({ code: "NOT_FOUND", message: "העסק לא נמצא." });
      }

      if (input.memberId === null) {
        await db
          .update(tables.businesses)
          .set({ ownerBookingName: input.name })
          .where(eq(tables.businesses.id, business.id));
        return { name: input.name };
      }

      try {
        const [member] = await db
          .update(tables.staffMembers)
          .set({ name: input.name })
          .where(
            and(
              eq(tables.staffMembers.id, input.memberId),
              eq(tables.staffMembers.businessId, business.id),
            ),
          )
          .returning(selectMember);
        if (!member) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "איש הצוות לא נמצא בעסק.",
          });
        }
        return { name: member.name };
      } catch (error) {
        if (hasDatabaseErrorCode(error, "23505")) throw nameTaken();
        throw error;
      }
    }),
});
