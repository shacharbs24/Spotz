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

/**
 * Clerk user IDs granted platform-admin access (comma-separated env var).
 * Parsed once at module load. Kept server-only — never expose this list to the
 * client, so the admin route's existence stays undiscoverable.
 */
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

/**
 * Procedure restricted to platform admins. Throws FORBIDDEN for everyone else
 * (including authenticated non-admins), so callers can map it to a 404.
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.clerkUserId || !ADMIN_USER_IDS.includes(ctx.clerkUserId)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx: { clerkUserId: ctx.clerkUserId, user: ctx.user } });
});
