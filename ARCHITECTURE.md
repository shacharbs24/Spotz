# Spotz — Architecture Overview

> Context document for continued work. Describes what Spotz is, how the monorepo
> is wired, the full data model, the tRPC API surface, auth/identity flows, the
> booking engine, and migration status. Kept current as of migration `0008`.

## What Spotz is

Spotz is an **appointment-booking platform for small businesses** (barbershops,
cosmetics, etc.), **Hebrew / RTL first** (`lang="he"`, `dir="rtl"`, Heebo font,
Clerk `heIL` localization).

- **Owners** manage a business, services, weekly hours, blocked periods (vacations),
  and a daily appointments agenda from a dashboard.
- **Clients** book on a public page `/b/[slug]` (works logged-out as a guest), and
  signed-in clients get a portal with their appointments + a re-book shortcut.
- App title: _"Spotz — מערכת לתיאום תורים"_. Default timezone `Asia/Jerusalem`.
- Money stored as **integer agorot** (`*_cents`), never floats. Default currency `ILS`.

## Tech Stack

| Concern        | Choice |
|----------------|--------|
| Monorepo       | Turborepo + pnpm workspaces (`pnpm@11`, Node ≥20) |
| Web framework  | Next.js 16 (App Router, RSC), React 19 |
| Styling        | Tailwind CSS v4 (`@theme` tokens in `globals.css`) |
| Auth           | Clerk (`@clerk/nextjs`, middleware-based) |
| API layer      | tRPC v11 + TanStack Query (client) + RSC server caller |
| Database       | PostgreSQL (Neon) via Drizzle ORM + `postgres-js` |
| Validation     | Zod (shared schemas reused client + server) |
| Time/timezones | Luxon (DST-correct slot math in the business timezone) |
| Webhook verify | `svix` (Clerk webhook signatures) |

## Monorepo Layout

```
Spotz/
├── apps/
│   └── web/                              # Next.js 16 app (the product)
│       └── src/
│           ├── app/
│           │   ├── page.tsx              # Home — role-branched (signed-out / owner / client portal)
│           │   ├── layout.tsx            # ClerkProvider + TRPCProvider, RTL
│           │   ├── sign-in/[[...sign-in]]/   # Clerk <SignIn> catch-all (handles OAuth sso-callback)
│           │   ├── sign-up/[[...sign-up]]/   # Clerk <SignUp> catch-all
│           │   ├── dashboard/            # owner: business, services, availability, appointments, blocked
│           │   ├── b/[slug]/             # public business booking page
│           │   ├── b/confirm/[appointmentId]/  # SMS-style confirm page (public)
│           │   └── api/
│           │       ├── trpc/[trpc]/route.ts        # tRPC fetch handler
│           │       └── webhooks/clerk/route.ts     # Clerk user webhook (svix)
│           ├── components/               # landing, dashboard/*, public/*, portal/*, ui/*
│           ├── lib/format.ts             # price (agorot→₪) + duration formatters
│           ├── trpc/                     # client.ts, Provider.tsx, server.ts, context.ts, types.ts
│           └── middleware.ts             # clerkMiddleware()
├── packages/
│   ├── api/   # @spotz/api — tRPC routers, context type, shared zod schemas
│   │   └── src/{trpc.ts, index.ts, routers/*, schemas/*}
│   └── db/    # @spotz/db — Drizzle schema + client (+ re-exported operators)
│       └── src/{schema.ts, index.ts}; drizzle/  (migrations 0000–0008)
└── turbo.json, pnpm-workspace.yaml, package.json
```

### Package dependency graph

```
apps/web ──▶ @spotz/api ──▶ @spotz/db ──▶ PostgreSQL (Neon)
        └──▶ @spotz/db
```

Internal packages ship **raw TypeScript** (`main`/`types` → `src/*.ts`); Next
transpiles them. `@spotz/db` re-exports drizzle operators (`eq`, `and`, `asc`,
…) so `apps/web` can query without a direct `drizzle-orm` dependency.

`@spotz/api` exposes **zod-only schema subpaths** (no DB imports → safe in the
client bundle), used by forms via `zodResolver`:
`@spotz/api/schemas/{business,service,availability,booking,appointment,block}`.

## Data Model (`packages/db/src/schema.ts`)

All PKs are `uuid` `defaultRandom()`. Timestamps are `timestamptz` unless noted.
Enums: `user_role` (`OWNER` | `CLIENT`), `appointment_status`
(`PENDING` | `CONFIRMED` | `CANCELLED` | `COMPLETED`).

| Table             | Key columns / purpose |
|-------------------|-----------------------|
| `users`           | Local projection of Clerk identity. `clerkUserId` (unique, source of truth), `email`, `fullName`, `phone`, `role`. |
| `businesses`      | `ownerId`→users (cascade). `name`, `slug` (unique → `/b/[slug]`), `description`, `imageUrl` (Base64 data URL or http URL), `phone`, `city`, `address`, `timezone`. Booking window: `autoOpenCalendar` (bool, default true), `autoOpenDays` (int, default 14), `manualOpenUntil` (date, nullable). |
| `business_photos` | (reserved, unused yet) image URLs + `sortOrder`. |
| `services`        | `businessId` (cascade). `name`, `description`, `durationMinutes` (default 30), `priceCents` (agorot), `currency`, `isActive`. |
| `working_hours`   | One row per `dayOfWeek` (0=Sun…6=Sat) per business. `startTime`/`endTime` (`time`), `isClosed`. Unique `(businessId, dayOfWeek)`. **Serves "availability".** |
| `blocked_periods` | Vacations / one-off blocks. `businessId` (cascade), `startAt`/`endAt` (timestamptz), `reason`. Index `(businessId, startAt)`. |
| `clients`         | **Booking contact, not an auth user.** `businessId` (cascade), `userId`→users (nullable, `ON DELETE SET NULL`), `fullName`, `phone`. Unique `(businessId, phone)` → upsert-by-phone. `userId` links a booking to a signed-in account. |
| `appointments`    | `businessId` (cascade), `serviceId`, `clientId`→**clients**, `startAt`/`endAt`, `status`, `priceCentsSnapshot` (price locked at booking), `notes`. Index `(businessId, startAt)`. |

Design decisions baked in:
- **Money as integer agorot**; **price snapshot** on appointments preserves history.
- **Clerk = identity source of truth**; `users` is keyed by `clerkUserId`.
- **Clients are separate from users.** Guests book by phone (no account needed);
  `appointments.clientId → clients.id`. A signed-in booking sets `clients.userId`.

## tRPC API (`packages/api/src`)

`trpc.ts` defines `Context = { clerkUserId: string | null }`, `publicProcedure`,
and `protectedProcedure` (throws `UNAUTHORIZED` when `clerkUserId` is null).
`index.ts` composes `appRouter` and exports the `AppRouter` type.

Owner-only writes are **gated server-side** by resolving the user and checking
`role === "OWNER"` (the sign-up `unsafeMetadata` role is never trusted as an
auth boundary). Routers:

| Router | Procedures |
|--------|-----------|
| (root) | `health` (public) |
| `businesses` | `getMyBusiness`, `upsertBusiness` (OWNER; slug-uniqueness; saves branding, location, booking window) |
| `services` | `getServices`, `createService`, `updateService`, `deleteService` (OWNER, ownership-checked) |
| `availability` | `getOurAvailability` (7-day week, defaults Sun–Thu 09–18 / Fri–Sat closed), `updateAvailability` (transactional replace of `working_hours`) |
| `appointments` | `getDashboardAppointments({ date })` (daily agenda, joins client+service, business-tz day bounds), `updateAppointmentStatus` (OWNER) |
| `blocks` | `getBlockedPeriods` (upcoming, labeled), `createBlockedPeriod` (full-day range or intraday hours), `deleteBlockedPeriod` |
| `me` | `getProfile` (role+name), `getMyAppointments` (`{ upcoming }`), `getMyPastAppointments({ cursor })` (paginated, newest-first, page size 10, offset cursor → `{ items, nextCursor }`), `getMyBusinesses` (distinct businesses the client has booked), `cancelMyAppointment` |
| `public` | `getBusinessBySlug` (+ computed `maxBookingDate`), `getAvailableSlots(businessId, serviceId, date)`, `createAppointment`, `getAppointmentDetails`, `updateAppointmentStatusPublic` (PENDING→CONFIRMED/CANCELLED only) |

### Client + server callers
- **Client:** `trpc/client.ts` (`createTRPCReact<AppRouter>()`) + `trpc/Provider.tsx`
  (tRPC + TanStack Query), mounted in `layout.tsx`.
- **RSC:** `trpc/server.ts` `getServerCaller()` → `appRouter.createCaller(ctx)` for
  in-process calls (used by `/b/[slug]` and the home page).
- Both build context via `trpc/context.ts` `createClerkContext()` (see Lazy Sync).

## Auth & identity flows

### Provider / middleware
- `middleware.ts` = bare `clerkMiddleware()` → **every route public by default**
  (no `auth.protect()`); owner gating is enforced in tRPC, not middleware.
- `layout.tsx` wraps the tree in `<ClerkProvider localization={heIL}>`.
- **Sign-in/up catch-all pages** (`app/sign-in/[[...sign-in]]`, `app/sign-up/[[...sign-up]]`)
  render Clerk's `<SignIn>`/`<SignUp>`. **Required** because the env sets
  `NEXT_PUBLIC_CLERK_SIGN_IN_URL`/`SIGN_UP_URL` — without these pages, Google/OAuth
  callbacks (`/sign-up/sso-callback`) 404 and sign-up fails.

### Role at sign-up
The landing `RoleSelect` opens `<SignUpButton mode="modal" unsafeMetadata={{ role }}>`
(OWNER → `/dashboard`, CLIENT → `/`). The role rides `unsafeMetadata` through the
OAuth redirect into account creation.

### Two sync paths (webhook + lazy)
1. **Webhook** (`app/api/webhooks/clerk/route.ts`): durable path. Verifies the
   **svix** signature (`CLERK_WEBHOOK_SECRET`), validates with Zod, and on
   `user.created`/`user.updated` upserts `users` (role from `unsafe_metadata`,
   applied **only on insert** — never overwrites an existing role). Can't reach
   `localhost` without a tunnel.
2. **Lazy sync** (`trpc/context.ts` `ensureUserSynced`): resilience + local-dev
   path. On the first authenticated request, if the `users` row is missing it
   fetches Clerk `currentUser()` and inserts (email, name, phone, role from
   `unsafeMetadata`), `onConflictDoNothing` to stay race-safe with the webhook.
   Hot path is one indexed lookup; the Clerk fetch + insert run only once.
   **Result: local dev works without a tunnel** — sign up and immediately use the app.

## Key data flows

### Appointment ↔ user linking
- `public.createAppointment` reads `ctx.clerkUserId` (the session, never client
  input). If signed in, it resolves the local `users.id` and sets `clients.userId`
  on the upsert (and never *unlinks* on a later guest booking with the same phone).
- The portal (`me.getMyAppointments`, `me.getMyBusinesses`) queries
  `appointments → clients (userId = me) → …`. So a booking shows in the portal iff
  it was made while signed in (or later backfilled by phone).

### Booking window
`businesses` booking-window fields → `public.getBusinessBySlug` computes
`maxBookingDate` (auto: `today + autoOpenDays`, rolling; manual: `manualOpenUntil`,
clamped ≥ today). The `BookingModal` only offers dates ≤ `maxBookingDate`;
`getAvailableSlots` and `createAppointment` **also enforce it server-side**.

### Slot engine (`public.ts` `computeAvailableSlots`)
For `(businessId, timezone, date, durationMinutes)` in the **business timezone**:
1. Map the date to a weekday (Luxon) → look up `working_hours`; bail if closed.
2. Generate candidate starts from open→close, **stepping by the service duration**,
   each blocking exactly `durationMinutes`.
3. Build a `busy` list = non-cancelled `appointments` + `blocked_periods` overlapping
   the day; exclude any slot overlapping a busy interval.
4. Drop past times (relative to now in the business tz).
`createAppointment` re-validates through the same function (anti-double-book) and
uses the service's duration for `endAt`.

## Features (where things live)

- **Business settings / branding** — `dashboard/business`, `components/dashboard/BusinessForm.tsx`.
  Name, slug (live `/b/<slug>` preview), description, **image upload** (file →
  Base64 data URL, ≤1MB, preview), city/address, timezone, booking-window controls.
- **Services** — `dashboard/services`, `components/dashboard/services/*` (manager +
  modal form + cards). Price entered in shekels → stored as agorot; per-service duration.
- **Availability** — `dashboard/availability`, `AvailabilityForm.tsx` (7-day toggles + times).
- **Blocked periods** — `dashboard/blocked`, `components/dashboard/blocked/*`
  (manager + modal form). Full-day range or intraday hours; feeds the slot engine.
- **Owner appointments (Daily Agenda)** — `dashboard/appointments`,
  `AppointmentsList.tsx`. 14-day date strip (defaults today), chronological timeline,
  status badges (green=confirmed, red=cancelled, amber=pending, plum=completed),
  confirm/complete/cancel actions.
- **Public booking page** — `b/[slug]/page.tsx` (RSC). Cover image → name →
  description → contact → services (`components/public/PublicServices.tsx`).
  `BookingModal.tsx`: date strip (≤ `maxBookingDate`) → live slots → name/phone → confirm.
- **Confirmation page** — `b/confirm/[appointmentId]` (public, no auth) +
  `ConfirmActions.tsx`. "אני מגיע" / "ביטול תור" → PENDING→CONFIRMED/CANCELLED.
- **Client portal** — home page CLIENT branch + `components/portal/ClientPortal.tsx`:
  upcoming (inline-confirm cancel), **paginated** past history (`useInfiniteQuery`,
  10 per page, "טען היסטוריה נוספת" load-more), and **"העסקים שלי"** re-book cards.

## WhatsApp reminders (24h before appointment)

Server-only feature that sends a WhatsApp reminder ~24h before an appointment.
Each reminder is a **WhatsApp template message whose 6th variable is a link to the
existing confirmation page `${APP_BASE_URL}/b/confirm/[appointmentId]`** (the same
page the client uses to confirm/cancel). No bot, no inbound handling, no replies.

### `appointment_messages` table (migration 0009)
Logs every outbound message — one row per message attempt — so sends are auditable
and **idempotent**. Columns:

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `appointmentId` | FK → appointments (cascade) |
| `businessId` | FK → businesses (cascade) |
| `clientId` | FK → clients (cascade) |
| `channel` | `message_channel` enum — currently `WHATSAPP` |
| `type` | `message_type` enum — currently `REMINDER_24H` |
| `status` | `message_status` enum — `PENDING` \| `SENT` \| `FAILED` \| `SKIPPED` |
| `scheduledFor` | when the reminder targets (appointment start − 24h) |
| `sentAt` | set on success |
| `providerMessageId` | Meta message id, set on success |
| `errorMessage` | failure / skip reason |
| `createdAt` / `updatedAt` | timestamps |

Constraints: **unique `(appointmentId, type)`** (one reminder of a given type per
appointment → prevents duplicate sends), index `(status, scheduledFor)`.

Enums: `message_channel` (`WHATSAPP`), `message_type` (`REMINDER_24H`),
`message_status` (`PENDING`/`SENT`/`FAILED`/`SKIPPED`).

### Provider — `packages/api/src/services/whatsapp.ts`
`sendWhatsAppReminder(args)` calls the **Meta WhatsApp Cloud API**
(`POST https://graph.facebook.com/{version}/{phoneNumberId}/messages`) with a
pre-approved template. The 24h template must expose **6 body variables in order**:
client name, business name, service name, date, time, **confirmation link**.
Returns `{ messageId }`; throws on non-OK response or missing id.

### Phone normalization — `packages/api/src/lib/phone.ts`
`normalizeIsraeliPhone(raw)` → Israeli numbers to WhatsApp's `972…` form
(`0501234567` / `+972501234567` → `972501234567`). Returns `null` when the number
is invalid; the runner then marks that message **`SKIPPED`** (never sends).

### Runner — `sendDueAppointmentReminders({ dryRun })`
In `packages/api/src/services/reminders.ts`, exported via **`@spotz/api/reminders`**.
- Selects appointments whose **local calendar day in the business timezone is
  tomorrow** (Luxon), status **`PENDING` or `CONFIRMED` only** — `CANCELLED` and
  `COMPLETED` are skipped.
- **Dedup:** claims the `(appointmentId, REMINDER_24H)` row via insert +
  `onConflictDoNothing`; a conflict (row already exists) ⇒ counted as a duplicate
  and skipped — the **unique `(appointmentId, type)`** constraint guarantees a
  single reminder per appointment even across overlapping cron runs.
- **Send path:** invalid phone ⇒ `SKIPPED`; success ⇒ `SENT` (+ `sentAt`,
  `providerMessageId`); failure ⇒ `FAILED` (+ `errorMessage`).
- **`dryRun: true` performs NO WhatsApp calls and NO database writes** — it only
  reports intent (`WOULD_SEND` / `WOULD_SKIP`).
- Returns a JSON summary: `{ dryRun, ranAt, considered, sent, failed, skipped,
  duplicates, results[] }`. Each `results[]` item includes `appointmentId`,
  `clientName`, `businessName`, `serviceName`, `date`, `time`, `phone` (normalized
  or null), **`confirmUrl`** (`${APP_BASE_URL}/b/confirm/${appointmentId}` — the
  exact link the template sends), and `outcome`.

### Cron route — `apps/web/src/app/api/cron/reminders/route.ts`
`GET` or `POST`. Requires `Authorization: Bearer ${CRON_SECRET}` (401 otherwise,
500 if `CRON_SECRET` is unset). Supports `?dryRun=1`. Runs on the Node runtime,
`force-dynamic`, and returns the runner's JSON summary. Production: point a
scheduler (e.g. Vercel Cron) at the route hourly with the bearer header.

### Env vars
```
APP_BASE_URL                   # base for the confirm link, e.g. https://spotz.app
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_API_VERSION           # e.g. v21.0
WHATSAPP_TEMPLATE_REMINDER_24H # approved template name
WHATSAPP_TEMPLATE_LANG         # optional, default "he"
CRON_SECRET                    # bearer token for the cron route
```

### Local dry-run test
Dev server on :3000, with `APP_BASE_URL` + `CRON_SECRET` set in
`apps/web/.env.local` (no WhatsApp credentials needed for dry-run):
```bash
curl -s "http://localhost:3000/api/cron/reminders?dryRun=1" \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```
Dry-run never calls WhatsApp and never writes to the DB; it returns the summary
with `WOULD_SEND` / `WOULD_SKIP` outcomes and each item's `confirmUrl`. Drop
`?dryRun=1` to actually send (requires the `WHATSAPP_*` vars + an approved template).

## Design system
Tailwind v4 with semantic tokens in `app/globals.css` `@theme` (warm light-luxury):
`surface`, `ink`/`ink-muted`, `line`, `owner` (plum), `client` (terracotta),
`success`/`danger`/`pending` (status), `shadow-soft`. Used as generated utilities
(`bg-owner`, `text-ink`, `bg-success-soft`, …). RTL throughout; reusable `ui/Modal.tsx`
(portal, backdrop, Escape, scroll-lock).

## Migrations (`packages/db/drizzle`)
| # | What |
|---|------|
| 0000 | Initial: users, businesses (incl. description, address), business_photos, services, working_hours, appointments + enums |
| 0001 | `businesses.city` |
| 0002 | `services.description` |
| 0003 | `clients` table; repoint `appointments.clientId` → clients |
| 0004 | `services.durationMinutes` default 30 |
| 0005 | `businesses.imageUrl` |
| 0006 | Booking window: `autoOpenCalendar`, `autoOpenDays`, `manualOpenUntil` |
| 0007 | `blocked_periods` table |
| 0008 | `clients.userId` (FK → users, `ON DELETE SET NULL`) |
| 0009 | `appointment_messages` table + enums (`message_channel`/`message_type`/`message_status`); unique `(appointmentId, type)`, index `(status, scheduledFor)` |

All applied to Neon. Every package type-checks clean
(`tsc --noEmit` for `packages/db`, `packages/api`, `apps/web`).

## Commands & env

```bash
pnpm dev                                   # turbo run dev (all)
pnpm exec tsc --noEmit -p apps/web/tsconfig.json     # typecheck a package
# DB (needs DATABASE_URL in env; locally sourced from apps/web/.env.local):
pnpm --filter @spotz/db run db:generate    # create migration from schema
pnpm --filter @spotz/db run db:migrate     # apply migrations
pnpm --filter @spotz/db run db:studio
```

`apps/web/.env.local` keys: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, and Clerk URL vars (prefer the v6
`NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `…SIGN_UP_FALLBACK_REDIRECT_URL`
over the deprecated `AFTER_SIGN_IN/UP_URL`). R2 keys are present but the upload
flow isn't built yet.

### Local dev notes
- **Webhooks need a tunnel** (ngrok / Clerk dev tunnel) to reach localhost; lazy
  sync covers the gap so you can develop without one.
- **Webhook harness**: `pnpm exec tsx scripts/test-webhook.ts [--role=OWNER --id=… --cleanup]`
  signs a mock `user.created` with the real secret and verifies the DB.

## Status / next steps
Core feature set is complete (auth, business, services, availability + blocked
periods, duration-driven booking engine with booking window, owner agenda,
confirmation page, client portal). Natural follow-ups:
- **SMS automation** — wire a provider to send the `/b/confirm/[appointmentId]` link.
- **R2 file upload** — replace Base64 images with presigned-URL uploads (`business_photos`).
- **Automated tests** — only the manual webhook harness exists today.
- Optional: phone-match backfill for legacy guest bookings (re-add when there's
  data — a prior run was a no-op: no unlinked clients / no users with phones).
