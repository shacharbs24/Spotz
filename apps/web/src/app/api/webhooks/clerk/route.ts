import { Webhook } from "svix";
import { z } from "zod";
import { db, tables } from "@spotz/db";

/**
 * Clerk user webhook. Keeps the local `users` table in sync with Clerk, which
 * is the identity source of truth. Verifies the Svix signature, then upserts
 * on `user.created` / `user.updated`.
 *
 * Configure the endpoint in the Clerk dashboard and set CLERK_WEBHOOK_SECRET.
 */

const emailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
});

const phoneNumberSchema = z.object({
  id: z.string(),
  phone_number: z.string(),
});

const userEventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    email_addresses: z.array(emailAddressSchema).default([]),
    primary_email_address_id: z.string().nullable().optional(),
    phone_numbers: z.array(phoneNumberSchema).default([]),
    primary_phone_number_id: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    // Role intent captured at sign-up via Clerk `unsafeMetadata`.
    // Client-writable, so treated as initial intent only — never as an
    // authorization boundary (owner actions are gated server-side).
    unsafe_metadata: z
      .object({ role: z.enum(["OWNER", "CLIENT"]).optional() })
      .optional(),
  }),
});

type UserEvent = z.infer<typeof userEventSchema>;

/** Picks the primary email (falls back to the first on record). */
function resolveEmail(data: UserEvent["data"]): string | null {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return (primary ?? data.email_addresses[0])?.email_address ?? null;
}

/** Picks the primary phone (falls back to the first on record). */
function resolvePhone(data: UserEvent["data"]): string | null {
  const primary = data.phone_numbers.find(
    (p) => p.id === data.primary_phone_number_id,
  );
  return (primary ?? data.phone_numbers[0])?.phone_number ?? null;
}

/** Joins first + last name into a single display name, or null if both empty. */
function resolveFullName(data: UserEvent["data"]): string | null {
  const fullName = [data.first_name, data.last_name]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  return fullName.length > 0 ? fullName : null;
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration, not a client error.
    return new Response("CLERK_WEBHOOK_SECRET is not set", { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  // Signature verification requires the raw, unparsed request body.
  const payload = await req.text();

  let verified: unknown;
  try {
    verified = new Webhook(secret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const parsed = userEventSchema.safeParse(verified);
  if (!parsed.success) {
    // We only care about user.* events; ignore anything we can't map.
    return new Response("Ignored", { status: 200 });
  }

  const { type, data } = parsed.data;
  if (type !== "user.created" && type !== "user.updated") {
    return new Response("Ignored", { status: 200 });
  }

  const email = resolveEmail(data);
  if (!email) {
    return new Response("User event has no email address", { status: 400 });
  }

  const fullName = resolveFullName(data);
  const phone = resolvePhone(data);
  // Default to CLIENT when no (valid) role intent was provided at sign-up.
  const role = data.unsafe_metadata?.role ?? "CLIENT";

  try {
    await db
      .insert(tables.users)
      .values({
        clerkUserId: data.id,
        email,
        fullName,
        phone,
        role,
      })
      // Set `role` only on insert: profile fields stay in sync on updates, but
      // an existing user's role is never overwritten from client metadata.
      .onConflictDoUpdate({
        target: tables.users.clerkUserId,
        set: { email, fullName, phone },
      });
  } catch (error) {
    console.error("Failed to upsert user from Clerk webhook", error);
    return new Response("Database error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
