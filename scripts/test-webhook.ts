/**
 * Local integration harness for the Clerk webhook → Neon sync.
 *
 * Signs a mock `user.created` event with the real CLERK_WEBHOOK_SECRET (exactly
 * how Clerk/Svix would), POSTs it to the running dev server, then queries the DB
 * with the Drizzle client to prove the user landed in the `users` table.
 *
 * Run from repo root (dev server must be up on :3000):
 *   pnpm exec tsx scripts/test-webhook.ts
 *
 * Flags:
 *   --role=OWNER|CLIENT   Attach role intent via unsafe_metadata (mirrors the
 *                         landing-page sign-up). Omit to test the default path.
 *   --id=user_xxx         Override the Clerk user id (default: user_test123).
 *   --email=foo@bar.com   Override the email (default: test@spotz.app).
 *   --name="First Last"   Override the full name (default: Test User).
 *   --cleanup             Delete the row after verifying, to keep the DB clean.
 *
 * Example — prove the OWNER mapping and clean up afterwards:
 *   pnpm exec tsx scripts/test-webhook.ts --role=OWNER --id=user_owner_demo --cleanup
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";

// Load env from apps/web/.env.local (same file the dev server uses).
const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, "../apps/web/.env.local");
dotenv.config({ path: envPath });

const WEBHOOK_URL = "http://localhost:3000/api/webhooks/clerk";

type Role = "OWNER" | "CLIENT";

interface Args {
  role?: Role;
  id: string;
  email: string;
  name: string;
  cleanup: boolean;
}

/** Minimal `--key=value` / `--flag` parser for the harness. */
function parseArgs(argv: readonly string[]): Args {
  const get = (key: string): string | undefined => {
    const match = argv.find((a) => a.startsWith(`--${key}=`));
    return match?.split("=").slice(1).join("=");
  };
  const has = (key: string): boolean => argv.includes(`--${key}`);

  const rawRole = get("role")?.toUpperCase();
  if (rawRole && rawRole !== "OWNER" && rawRole !== "CLIENT") {
    throw new Error(`Invalid --role "${rawRole}". Use OWNER or CLIENT.`);
  }

  return {
    role: rawRole as Role | undefined,
    id: get("id") ?? "user_test123",
    email: get("email") ?? "test@spotz.app",
    name: get("name") ?? "Test User",
    cleanup: has("cleanup"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(`CLERK_WEBHOOK_SECRET not found (looked in ${envPath})`);
  }

  const [firstName, ...rest] = args.name.split(" ");
  const lastName = rest.join(" ") || null;

  // 1. Build a mock Clerk user.created event (only the fields our route reads).
  //    unsafe_metadata.role mirrors what the landing-page sign-up attaches.
  const event = {
    type: "user.created",
    data: {
      id: args.id,
      email_addresses: [{ id: "idn_email_1", email_address: args.email }],
      primary_email_address_id: "idn_email_1",
      phone_numbers: [],
      primary_phone_number_id: null,
      first_name: firstName ?? null,
      last_name: lastName,
      ...(args.role ? { unsafe_metadata: { role: args.role } } : {}),
    },
  };
  const body = JSON.stringify(event);

  // 2. Sign it exactly like Svix does on Clerk's side.
  const wh = new Webhook(secret);
  const msgId = `msg_${Date.now()}`;
  const timestamp = new Date();
  const signature = wh.sign(msgId, timestamp, body);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "svix-id": msgId,
    "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
    "svix-signature": signature,
  };

  // 3. POST to the running dev server.
  console.log(
    `→ POST ${WEBHOOK_URL} (clerkUserId=${args.id}, role=${args.role ?? "—(default CLIENT)"})`,
  );
  let res: Response;
  try {
    res = await fetch(WEBHOOK_URL, { method: "POST", headers, body });
  } catch (err) {
    throw new Error(
      `Request failed — is the dev server running on :3000? (${String(err)})`,
    );
  }
  const text = await res.text();
  console.log(`← ${res.status} ${res.statusText} — "${text}"`);

  if (!res.ok) {
    throw new Error(`Webhook responded ${res.status}; aborting DB check.`);
  }

  // 4. Verify via the Drizzle client (imported after env is loaded, since
  //    @spotz/db reads DATABASE_URL at module init).
  const { db, tables } = await import("@spotz/db");
  const [row] = await db
    .select()
    .from(tables.users)
    .where(eq(tables.users.clerkUserId, args.id));

  // 5. Print the result.
  if (!row) {
    throw new Error(`No row found for ${args.id} in users table.`);
  }
  console.log("\n✅ User found in Neon `users` table:");
  console.log(JSON.stringify(row, null, 2));

  // Assert the role mapped as expected when a role was requested.
  if (args.role && row.role !== args.role) {
    throw new Error(
      `Role mismatch: expected ${args.role}, got ${row.role}.`,
    );
  }
  if (args.role) {
    console.log(`\n🎯 Role correctly persisted as ${row.role}.`);
  }

  // 6. Optional cleanup.
  if (args.cleanup) {
    await db.delete(tables.users).where(eq(tables.users.clerkUserId, args.id));
    console.log(`\n🧹 Cleaned up: deleted ${args.id} from users table.`);
  }

  // Close the pg connection so the script exits cleanly.
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
