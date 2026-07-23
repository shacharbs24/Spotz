import { initTRPC, TRPCError } from "@trpc/server";

/** Minimal local-user projection carried on the request context. */
export interface AuthUser {
  id: string;
  role: "OWNER" | "CLIENT";
  fullName: string | null;
  phone: string | null;
}

/**
 * tRPC context — populated per request in apps/web.
 * `clerkUserId` is the source-of-truth identity from Clerk; `user` is the local
 * `users` row, loaded once per request so procedures don't each re-query it.
 */
export interface Context {
  clerkUserId: string | null;
  user: AuthUser | null;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Procedure that requires an authenticated Clerk user. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.clerkUserId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { clerkUserId: ctx.clerkUserId, user: ctx.user } });
});
