import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, tables } from "@spotz/db";
import { protectedProcedure, router, type AuthUser } from "../trpc";
import { getBookingOwnerName } from "../lib/booking-owner-name";
import { hasDatabaseErrorCode } from "../lib/database-errors";

const nameSchema = z
  .string()
  .trim()
  .min(2, "הזינו לפחות שני תווים.")
  .max(80, "השם יכול להכיל עד 80 תווים.");

const selectMember = {
  id: tables.staffMembers.id,
  name: tables.staffMembers.name,
};

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
