import { initTRPC, TRPCError } from "@trpc/server";

/**
 * tRPC context — populated per request in apps/web.
 * `clerkUserId` is the source-of-truth identity from Clerk.
 */
export interface Context {
  clerkUserId: string | null;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Procedure that requires an authenticated Clerk user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.clerkUserId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { clerkUserId: ctx.clerkUserId } });
});
