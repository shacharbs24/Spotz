import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db, tables, eq } from "@spotz/db";
import type { Context } from "@spotz/api";

/**
 * Ensures the authenticated Clerk user has a local `users` row. The webhook is
 * the durable sync path, but it can't reach localhost without a tunnel — this
 * lazily backfills the row on the first authenticated request (and acts as a
 * safety net in production if a webhook is ever missed).
 *
 * Cheap on the hot path: a single indexed lookup; the Clerk fetch + insert only
 * run once, when the row is missing.
 */
async function ensureUserSynced(clerkUserId: string): Promise<void> {
  const [existing] = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.clerkUserId, clerkUserId));
  if (existing) return;

  const user = await currentUser();
  if (!user || user.id !== clerkUserId) return;

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;
  // email is NOT NULL; if Clerk hasn't surfaced one yet, leave it to the webhook.
  if (!email) return;

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null;
  const phone =
    user.primaryPhoneNumber?.phoneNumber ??
    user.phoneNumbers[0]?.phoneNumber ??
    null;
  // Mirror the webhook: role intent comes from unsafeMetadata, defaulting CLIENT.
  const roleRaw = (user.unsafeMetadata as { role?: unknown })?.role;
  const role = roleRaw === "OWNER" || roleRaw === "CLIENT" ? roleRaw : "CLIENT";

  await db
    .insert(tables.users)
    .values({ clerkUserId, email, fullName, phone, role })
    .onConflictDoNothing({ target: tables.users.clerkUserId });
}

/**
 * Builds the per-request tRPC context. Maps the Clerk session to `clerkUserId`
 * and lazily syncs the local user row.
 */
export async function createClerkContext(): Promise<Context> {
  const { userId } = await auth();
  if (userId) {
    try {
      await ensureUserSynced(userId);
    } catch (error) {
      // Never block a request on sync — the webhook remains the source of truth.
      console.error("Lazy user sync failed", error);
    }
  }
  return { clerkUserId: userId };
}
