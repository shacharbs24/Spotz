import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db, tables, eq } from "@spotz/db";
import type { AuthUser, Context } from "@spotz/api";

/** Columns projected into `ctx.user`; keep in sync with AuthUser. */
const userColumns = {
  id: tables.users.id,
  role: tables.users.role,
  fullName: tables.users.fullName,
  phone: tables.users.phone,
} as const;

/**
 * Loads the local `users` row for the authenticated Clerk user, lazily creating
 * it on first sight. The webhook is the durable sync path, but it can't reach
 * localhost without a tunnel — this backfills the row on the first authenticated
 * request (and is a safety net in production if a webhook is ever missed).
 *
 * Cheap on the hot path: a single indexed lookup; the Clerk fetch + insert only
 * run once, when the row is missing.
 */
async function loadOrSyncUser(clerkUserId: string): Promise<AuthUser | null> {
  const [existing] = await db
    .select(userColumns)
    .from(tables.users)
    .where(eq(tables.users.clerkUserId, clerkUserId));
  if (existing) return existing;

  const user = await currentUser();
  if (!user || user.id !== clerkUserId) return null;

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;
  // email is NOT NULL; if Clerk hasn't surfaced one yet, leave it to the webhook.
  if (!email) return null;

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
  const phone =
    user.primaryPhoneNumber?.phoneNumber ??
    user.phoneNumbers[0]?.phoneNumber ??
    null;
  // Mirror the webhook: role intent comes from unsafeMetadata, defaulting CLIENT.
  const roleRaw = (user.unsafeMetadata as { role?: unknown })?.role;
  const role = roleRaw === "OWNER" || roleRaw === "CLIENT" ? roleRaw : "CLIENT";

  const [inserted] = await db
    .insert(tables.users)
    .values({ clerkUserId, email, fullName, phone, role })
    .onConflictDoNothing({ target: tables.users.clerkUserId })
    .returning(userColumns);
  if (inserted) return inserted;

  // Lost an insert race — the row now exists; read it back.
  const [row] = await db
    .select(userColumns)
    .from(tables.users)
    .where(eq(tables.users.clerkUserId, clerkUserId));
  return row ?? null;
}

/**
 * Builds the per-request tRPC context. Maps the Clerk session to `clerkUserId`
 * and loads the local user row once so procedures can read `ctx.user` instead
 * of each re-querying it.
 */
export async function createClerkContext(): Promise<Context> {
  const { userId } = await auth();
  if (!userId) return { clerkUserId: null, user: null };

  let user: AuthUser | null = null;
  try {
    user = await loadOrSyncUser(userId);
  } catch (error) {
    // Never block a request on sync — the webhook remains the source of truth.
    console.error("Lazy user load/sync failed", error);
  }
  return { clerkUserId: userId, user };
}
