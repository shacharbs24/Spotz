import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, tables } from "@spotz/db";
import { protectedProcedure, router, type AuthUser } from "../trpc";

async function getOwnedBusiness(user: AuthUser | null) {
  if (user?.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ניהול צוות זמין לבעלי העסק בלבד.",
    });
  }

  const [business] = await db
    .select({ id: tables.businesses.id })
    .from(tables.businesses)
    .where(eq(tables.businesses.ownerId, user.id));
  return business;
}

export const staffRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const business = await getOwnedBusiness(ctx.user);
    if (!business) return { hasBusiness: false, members: [] };

    const members = await db
      .select({ id: tables.staffMembers.id, name: tables.staffMembers.name })
      .from(tables.staffMembers)
      .where(eq(tables.staffMembers.businessId, business.id))
      .orderBy(asc(tables.staffMembers.createdAt), asc(tables.staffMembers.id));
    return { hasBusiness: true, members };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .min(2, "הזינו לפחות שני תווים.")
          .max(80, "השם יכול להכיל עד 80 תווים."),
      }),
    )
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
        .returning({
          id: tables.staffMembers.id,
          name: tables.staffMembers.name,
        });
      if (!member) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "השם הזה כבר מופיע ברשימת הצוות.",
        });
      }
      return member;
    }),
});
