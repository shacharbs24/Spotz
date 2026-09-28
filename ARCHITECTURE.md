# Spotz — Architecture Overview

> Context document for continued work. Describes what Spotz is, how the monorepo
> is wired, the full data model, the tRPC API surface, auth/identity flows, the
> booking engine, reviews, WhatsApp reminders, media storage, and migration
> status. Kept current as of migration `0017`.

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

| Concern        | Choice                                                 |
| -------------- | ------------------------------------------------------ |
| Monorepo       | Turborepo + pnpm workspaces (`pnpm@11`, Node ≥20)      |
| Web framework  | Next.js 16 (App Router, RSC), React 19                 |
| Styling        | Tailwind CSS v4 (`@theme` tokens in `globals.css`)     |
| Auth           | Clerk (`@clerk/nextjs`, Next.js request-proxy based)   |
| API layer      | tRPC v11 + TanStack Query (client) + RSC server caller |
| Database       | PostgreSQL (Neon) via Drizzle ORM + `postgres-js`      |
| Validation     | Zod (shared schemas reused client + server)            |
| Time/timezones | Luxon (DST-correct slot math in the business timezone) |
| Webhook verify | `svix` (Clerk webhook signatures)                      |
| Media storage  | Vercel Blob (business images) + `next/image`           |

## Monorepo Layout

```
Spotz/
├── .github/workflows/ci.yml               # push/PR: types, lint, unit tests
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
│           │   ├── b/confirm/[appointmentId]/  # token-guarded confirm page
│           │   └── api/
│           │       ├── trpc/[trpc]/route.ts        # tRPC fetch handler
│           │       ├── blob/upload/route.ts        # Vercel Blob client-upload token (owner-scoped)
│           │       ├── cron/reminders/route.ts     # 24h WhatsApp reminder cron (bearer-auth)
│           │       └── webhooks/clerk/route.ts     # Clerk user webhook (svix)
│           ├── components/               # landing, dashboard/*, public/*, portal/*, ui/*
│           ├── lib/format.ts             # price (agorot→₪) + duration formatters
│           ├── trpc/                     # client.ts, Provider.tsx, server.ts, context.ts, types.ts
│           └── proxy.ts                  # clerkMiddleware() (Next.js 16)
├── packages/
│   ├── api/   # @spotz/api — tRPC routers, context type, shared zod schemas
│   │   ├── src/{trpc.ts, index.ts, routers/*, schemas/*, services/*, lib/*, domain/*}
│   │   └── test/*.test.ts                 # database-free Node test suite
│   └── db/    # @spotz/db — Drizzle schema + client (+ re-exported operators)
│       └── src/{schema.ts, index.ts}; drizzle/  (migrations 0000–0017)
├── scripts/                                # one-off migrations + webhook test harness (tsx)
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
`@spotz/api/schemas/{business,service,availability,booking,appointment,block,review,profile}`.
It also exposes `@spotz/api/lib/phone` and `@spotz/api/reminders` (server-only).

## Data Model (`packages/db/src/schema.ts`)

All PKs are `uuid` `defaultRandom()`. Timestamps are `timestamptz` unless noted.
Enums: `user_role` (`OWNER` | `CLIENT`), `appointment_status`
(`PENDING` | `CONFIRMED` | `CANCELLED` | `COMPLETED`), plus the messaging enums
`message_channel` / `message_type` / `message_status` (see WhatsApp reminders).

| Table             | Key columns / purpose                                                                                                                                                                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`           | Local projection of Clerk identity. `clerkUserId` (unique, source of truth), `email`, `fullName`, `phone`, `role`.                                                                                                                                                                                                               |
| `businesses`      | `ownerId`→users (cascade). `name`, `slug` (unique → `/b/[slug]`), `description`, `imageUrl` (hosted image URL — Vercel Blob, `https://` only, no base64), `phone`, `city`, `address`, `timezone`. Booking window: `autoOpenCalendar` (bool, default true), `autoOpenDays` (int, default 14), `manualOpenUntil` (date, nullable). |
| `business_photos` | (reserved, unused yet) image URLs + `sortOrder`.                                                                                                                                                                                                                                                                                 |
| `services`        | `businessId` (cascade). `name`, `description`, `durationMinutes` (default 30), `priceCents` (agorot), `currency`, `isActive`, `requiresApproval` (default true → bookings start `PENDING` for manual owner approval; `false` → auto-`CONFIRMED`).                                                                                |
| `working_hours`   | One row per `dayOfWeek` (0=Sun…6=Sat) per business. `startTime`/`endTime` (`time`), `isClosed`, `breaks` (jsonb `{start,end}[]` — intraday pauses excluded from bookable slots). Unique `(businessId, dayOfWeek)`. **Serves "availability".**                                                                                    |
| `blocked_periods` | Vacations / one-off blocks. `businessId` (cascade), `startAt`/`endAt` (timestamptz), `reason`. Index `(businessId, startAt)`.                                                                                                                                                                                                    |
| `clients`         | **Per-business booking contact.** `businessId` (cascade), `userId`→users (nullable for legacy rows, `ON DELETE SET NULL`), `fullName`, `phone`. Authenticated contacts are unique by `(businessId, userId)`; phone is mutable contact data, not identity.                                                                        |
| `appointments`    | `businessId` (cascade), `serviceId`, `clientId`→**clients**, `startAt`/`endAt`, `status`, private `confirmationToken`, `arrivalConfirmedAt`, `priceCentsSnapshot`, `notes`. An exclusion constraint prevents overlapping non-cancelled appointments per business.                                                                |
| `reviews`         | Business reviews. `businessId` (cascade), `appointmentId`→appointments (nullable, appointment-linked) / `clientId`→clients (nullable), `rating` 1–5 (check-constrained), `comment`, `reviewerName` (direct public reviews), `isVisible`. Unique `(appointmentId)`; indexes `(businessId, createdAt)`, `(businessId, isVisible)`. |

Design decisions baked in:

- **Money as integer agorot**; **price snapshot** on appointments preserves history.
- **Clerk = identity source of truth**; `users` is keyed by `clerkUserId`.
- **Clients are separate from users.** `clients` is the per-business booking
  contact (`appointments.clientId → clients.id`), keyed by `(businessId, userId)`
  for authenticated bookings. A shared or changed phone cannot transfer history.
  Booking now **requires a signed-in, onboarded user** (see Booking auth); the
  client row is upserted from the user's profile and linked via `clients.userId`.
  Guest identity by phone remains for legacy rows and the public confirm page.

## tRPC API (`packages/api/src`)

`trpc.ts` defines `Context = { clerkUserId: string | null; user: AuthUser | null }`,
`publicProcedure`, `protectedProcedure` (throws `UNAUTHORIZED` when `clerkUserId`
is null), and `adminProcedure` (throws `FORBIDDEN` unless the Clerk id is in
`ADMIN_USER_IDS`). `index.ts` composes `appRouter` and exports the `AppRouter` type.

Owner-only writes are **gated server-side** by resolving the user and checking
`role === "OWNER"` (the sign-up `unsafeMetadata` role is never trusted as an
auth boundary). Routers:

| Router         | Procedures                                                                                                                                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (root)         | `health` (public)                                                                                                                                                                                                                                                                                                                            |
| `businesses`   | `getMyBusiness`, `upsertBusiness` (OWNER; slug-uniqueness; saves branding, location, booking window; deletes the previous Blob image on change)                                                                                                                                                                                              |
| `services`     | `getServices`, `createService`, `updateService`, `deleteService` (OWNER, ownership-checked)                                                                                                                                                                                                                                                  |
| `availability` | `getOurAvailability` (7-day week, defaults Sun–Thu 09–18 / Fri–Sat closed), `updateAvailability` (transactional replace of `working_hours`, incl. `breaks`)                                                                                                                                                                                  |
| `appointments` | `getDashboardAppointments({ date })` (daily agenda, joins client+service, business-tz day bounds), `getAppointmentHistory` (OWNER, paginated), `updateAppointmentStatus` (OWNER)                                                                                                                                                             |
| `blocks`       | `getBlockedPeriods` (upcoming, labeled), `createBlockedPeriod` (full-day range or intraday hours), `deleteBlockedPeriod`                                                                                                                                                                                                                     |
| `me`           | `getProfile` (role+name), `updateProfile` (name + normalized phone — the onboarding write), `getMyAppointments` (`{ upcoming }`), `getMyPastAppointments({ cursor })` (paginated, newest-first, page size 10, offset cursor → `{ items, nextCursor }`), `getMyBusinesses` (distinct businesses the client has booked), `cancelMyAppointment` |
| `reviews`      | `createReview` (from a completed appointment), `createBusinessReview` (public/direct, with `reviewerName`), `getBusinessReviews`, `getBusinessRatingSummary`, `updateReviewVisibility` (OWNER)                                                                                                                                               |
| `public`       | `getBusinessBySlug` (+ computed `maxBookingDate`), `getAvailableSlots(businessId, serviceId, date)`, **`createAppointment` (protected — requires a signed-in, onboarded user; see Booking auth)**, token-guarded `getAppointmentDetails` / `updateAppointmentStatusPublic`                                                                   |
| `admin`        | `getOverview` (platform-admin only, gated by `ADMIN_USER_IDS`)                                                                                                                                                                                                                                                                               |

### Client + server callers

- **Client:** `trpc/client.ts` (`createTRPCReact<AppRouter>()`) + `trpc/Provider.tsx`
  (tRPC + TanStack Query), mounted in `layout.tsx`.
- **RSC:** `trpc/server.ts` `getServerCaller()` → `appRouter.createCaller(ctx)` for
  in-process calls (used by `/b/[slug]` and the home page).
- Both build context via `trpc/context.ts` `createClerkContext()` (see Lazy Sync).

## Auth & identity flows

### Provider / request proxy

- `proxy.ts` = bare `clerkMiddleware()` → **every route public by default**
  (no `auth.protect()`); owner gating is enforced in tRPC, not the proxy.
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
2. **Lazy sync** (`trpc/context.ts` — `createClerkContext` → `loadOrSyncUser`):
   resilience + local-dev path. On the first authenticated request, if the
   `users` row is missing it
   fetches Clerk `currentUser()` and inserts (email, name, phone, role from
   `unsafeMetadata`), `onConflictDoNothing` to stay race-safe with the webhook.
   Hot path is one indexed lookup; the Clerk fetch + insert run only once.
   **Result: local dev works without a tunnel** — sign up and immediately use the app.

## Key data flows

### Booking auth + appointment ↔ user linking

- `public.createAppointment` is a **`protectedProcedure`**: it requires an
  authenticated user (`ctx.user`, else `NOT_FOUND`) **and a completed profile** —
  a non-empty `fullName` and a normalizable phone, else `PRECONDITION_FAILED`
  ("complete your profile before booking"). **Guests cannot book.**
- The per-business `clients` row is **upserted from the user's profile**
  (name + normalized phone) on `(businessId, userId)`. Phone changes update
  contact data without changing ownership of current or historical appointments.
- Status on create: **`PENDING` when the service `requiresApproval`, else
  `CONFIRMED`** (auto-confirm).
- The portal (`me.getMyAppointments`, `me.getMyBusinesses`) queries
  `appointments → clients (userId = me) → …`, so every booking (always made
  signed-in now) appears in the booker's portal.

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
   the day **+ the day's `working_hours.breaks`**; exclude any slot overlapping a
   busy interval.
4. Drop past times (relative to now in the business tz).
   `createAppointment` re-validates through the same function and uses the service's
   duration for `endAt`. A PostgreSQL exclusion constraint is the concurrency-safe
   final guard against overlapping active appointments.

## Features (where things live)

- **Business settings / branding** — `dashboard/business`, `components/dashboard/BusinessForm.tsx`.
  Name, slug (live `/b/<slug>` preview), description, public phone, **image upload** (client
  upload straight to Vercel Blob via `/api/blob/upload`, ≤1MB, image types only;
  stores the returned URL), city/address, timezone, booking-window controls.
- **Services** — `dashboard/services`, `components/dashboard/services/*` (manager +
  modal form + cards). Price entered in shekels → stored as agorot; a service
  referenced by historical appointments is archived instead of hard-deleted; per-service
  duration; **`requiresApproval` toggle** (manual approval → bookings start `PENDING`,
  else auto-`CONFIRMED`).
- **Availability** — `dashboard/availability`, `AvailabilityForm.tsx` (7-day toggles + times + intraday `breaks`).
- **Blocked periods** — `dashboard/blocked`, `components/dashboard/blocked/*`
  (manager + modal form). Full-day range or intraday hours; feeds the slot engine.
- **Owner appointments (Daily Agenda)** — `dashboard/appointments`,
  `AppointmentsList.tsx`. 14-day date strip (defaults today), chronological timeline,
  status badges (green=confirmed, red=cancelled, amber=pending, plum=completed),
  confirm/complete/cancel actions.
- **Public booking page** — `b/[slug]/page.tsx` (RSC). Cover image → name →
  description → contact → services (`components/public/PublicServices.tsx`).
  `BookingModal.tsx`: date strip (≤ `maxBookingDate`) → live slots → confirm;
  client identity comes from the onboarded profile.
- **Confirmation page** — `b/confirm/[appointmentId]?token=…` (no login, private
  bearer token) + `ConfirmActions.tsx`. "אני מגיע" / "ביטול תור" updates only
  when both the appointment id and confirmation token match.
- **Client portal** — home page CLIENT branch + `components/portal/ClientPortal.tsx`:
  upcoming (inline-confirm cancel), **paginated** past history (`useInfiniteQuery`,
  10 per page, "טען היסטוריה נוספת" load-more), and **"העסקים שלי"** re-book cards.
- **Reviews** — the public page shows a rating summary + list
  (`components/public/BusinessReviews.tsx`, `ui/StarRating.tsx`); clients leave a
  review from a completed appointment or directly via `PublicReviewButton.tsx`
  (with `reviewerName`). Owners toggle visibility (`reviews.updateReviewVisibility`).
- **Arrival confirmation** — the confirm page's "אני מגיע" records
  `appointments.arrivalConfirmedAt` (tracked separately from `status`).

## WhatsApp reminders (24h before appointment)

Server-only feature that sends a WhatsApp reminder ~24h before an appointment.
Each reminder is a **WhatsApp template message whose 6th variable is a private,
tokenized link to the existing confirmation page** (the same page the client uses
to confirm/cancel). No bot, no inbound handling, no replies.

### `appointment_messages` table (migration 0009)

Logs one durable row per appointment/message type. Retry attempts update that row,
so sends stay auditable and **idempotent**. Columns:

| Column                    | Notes                                                                |
| ------------------------- | -------------------------------------------------------------------- |
| `id`                      | uuid PK                                                              |
| `appointmentId`           | FK → appointments (cascade)                                          |
| `businessId`              | FK → businesses (cascade)                                            |
| `clientId`                | FK → clients (cascade)                                               |
| `channel`                 | `message_channel` enum — currently `WHATSAPP`                        |
| `type`                    | `message_type` enum — currently `REMINDER_24H`                       |
| `status`                  | `message_status` enum — `PENDING` \| `SENT` \| `FAILED` \| `SKIPPED` |
| `attemptCount`            | provider attempts made; bounded to 3 by the runner                   |
| `nextAttemptAt`           | next eligible retry time after a provider failure                    |
| `scheduledFor`            | when the reminder targets (appointment start − 24h)                  |
| `sentAt`                  | set on success                                                       |
| `providerMessageId`       | Meta message id, set on success                                      |
| `errorMessage`            | failure / skip reason                                                |
| `createdAt` / `updatedAt` | timestamps                                                           |

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

- Selects appointments starting after now and within the next 24 hours, status
  **`PENDING` or `CONFIRMED` only**. The hourly schedule makes the first run after
  an appointment enters this window its due run, while later runs provide catch-up.
- **Dedup:** claims the `(appointmentId, REMINDER_24H)` row via insert +
  `onConflictDoNothing`; a conflict (row already exists) ⇒ counted as a duplicate
  and skipped unless the existing row is a due `FAILED` attempt. A due retry is
  claimed atomically by changing `FAILED` back to `PENDING`; at most 3 provider
  attempts are made, one hour apart.
- **Send path:** invalid phone ⇒ `SKIPPED`; success ⇒ `SENT` (+ `sentAt`,
  `providerMessageId`); failure ⇒ `FAILED` (+ `errorMessage`, `nextAttemptAt`
  when another attempt remains). Provider requests time out after 15 seconds.
- **`dryRun: true` performs NO WhatsApp calls and NO database writes** — it only
  reports intent (`WOULD_SEND` / `WOULD_SKIP`).
- Returns a JSON summary: `{ dryRun, ranAt, considered, sent, failed, skipped,
duplicates, retried, results[] }`. Each `results[]` item includes `appointmentId`,
  `clientName`, `businessName`, `serviceName`, `date`, `time`, `phone` (normalized
  or null), **`confirmUrl`** (appointment path + private confirmation token), and
  `outcome`.

### Cron route — `apps/web/src/app/api/cron/reminders/route.ts`

`GET` or `POST`. Requires `Authorization: Bearer ${CRON_SECRET}` (401 otherwise,
500 if `CRON_SECRET` is unset). Supports `?dryRun=1`. Runs on the Node runtime,
`force-dynamic`, and returns the runner's JSON summary. The production scheduler
is `.github/workflows/reminders.yml`, which calls the deployed endpoint hourly at
minute 17. GitHub Actions stores `CRON_SECRET` as a repository secret and
`APP_BASE_URL` as a repository variable. Vercel stores the same `CRON_SECRET` as
an environment variable. A manually dispatched workflow defaults to dry-run;
scheduled runs send live reminders.

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

## Media / image storage (Vercel Blob)

Business images live in **Vercel Blob**, not the database.

- **Upload:** the browser uploads the file **directly to Blob** via
  `@vercel/blob/client` `upload()`, using a short-lived token minted by
  `app/api/blob/upload/route.ts`. That route authorizes **owner-only** and scopes
  the token (image content-types, ≤1MB); a signed-in owner can only mint a token
  for their own business. Bytes never pass through the serverless function or tRPC.
- **Persistence:** the returned `…public.blob.vercel-storage.com/…` URL is saved to
  `businesses.imageUrl` via `businesses.upsertBusiness`.
- **Cleanup:** on image change/removal, `upsertBusiness` deletes the previous
  Blob — only Blob-hosted URLs; external/legacy URLs are left untouched.
- **Rendering:** `next/image` with `images.remotePatterns` allow-listing the Blob
  host (`apps/web/next.config.ts`); the public cover uses `priority` (LCP).
- **Backfill:** `scripts/migrate-business-images-to-blob.ts` (dry-run by default,
  `--execute`, `--database-url=`) moved existing base64 `data:` rows into Blob.
- **Auth env:** `BLOB_READ_WRITE_TOKEN`.
- **zod note:** `@vercel/blob` pulls `zod` v4 transitively; `pnpm-workspace.yaml`
  pins a single `zod` version (`overrides`) so the app's shared schemas + form
  resolvers stay coherent.

## Design system

Tailwind v4 with semantic tokens in `app/globals.css` `@theme` (warm light-luxury):
`surface`, `ink`/`ink-muted`, `line`, `owner` (plum), `client` (terracotta),
`success`/`danger`/`pending` (status), `shadow-soft`. Used as generated utilities
(`bg-owner`, `text-ink`, `bg-success-soft`, …). RTL throughout. The shared
accessibility baseline includes a skip-to-content link on every route, a visible
`:focus-visible` outline, reduced-motion handling, and `ui/Modal.tsx` with an
accessible title, initial focus, focus trapping/restoration, Escape, backdrop,
and scroll locking. This is a tested technical baseline, not a claim of full
WCAG/Israeli-regulation compliance or a substitute for an accessibility audit.
Public legal routes live at `/privacy`, `/terms`, and `/accessibility`; the shared
footer links them across the application. Operator/contact details are centralized
in `src/lib/legal.ts` so they can be updated when the business registration changes.

## Migrations (`packages/db/drizzle`)

| #    | What                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0000 | Initial: users, businesses (incl. description, address), business_photos, services, working_hours, appointments + enums                                  |
| 0001 | `businesses.city`                                                                                                                                        |
| 0002 | `services.description`                                                                                                                                   |
| 0003 | `clients` table; repoint `appointments.clientId` → clients                                                                                               |
| 0004 | `services.durationMinutes` default 30                                                                                                                    |
| 0005 | `businesses.imageUrl`                                                                                                                                    |
| 0006 | Booking window: `autoOpenCalendar`, `autoOpenDays`, `manualOpenUntil`                                                                                    |
| 0007 | `blocked_periods` table                                                                                                                                  |
| 0008 | `clients.userId` (FK → users, `ON DELETE SET NULL`)                                                                                                      |
| 0009 | `appointment_messages` table + enums (`message_channel`/`message_type`/`message_status`); unique `(appointmentId, type)`, index `(status, scheduledFor)` |
| 0010 | `reviews` table (+ FKs, indexes)                                                                                                                         |
| 0011 | `reviews`: `appointmentId`/`clientId` nullable + `reviewerName` (direct public reviews)                                                                  |
| 0012 | `services.requiresApproval` (default `false`)                                                                                                            |
| 0013 | `services.requiresApproval` default → `true`                                                                                                             |
| 0014 | `appointments.arrivalConfirmedAt`                                                                                                                        |
| 0015 | `working_hours.breaks` (jsonb)                                                                                                                           |
| 0016 | Private confirmation tokens; one business per owner; contacts keyed by business+user; no overlapping active appointments.                                |
| 0017 | Reminder attempt count and next retry timestamp.                                                                                                         |

Migrations through 0017 are applied to both the development and production Neon
branches. Every package type-checks clean via `pnpm check-types`.

## Commands & env

```bash
pnpm dev                                   # turbo run dev (all)
pnpm check-types                            # all workspace packages via Turbo
pnpm lint                                   # Next.js/React lint
pnpm test                                   # API unit tests via Node + tsx
pnpm build                                  # production Next.js build
# DB (needs DATABASE_URL in env; locally sourced from apps/web/.env.local):
pnpm --filter @spotz/db run db:generate    # create migration from schema
pnpm --filter @spotz/db run db:migrate     # apply migrations
pnpm --filter @spotz/db run db:studio
```

`apps/web/.env.local` keys: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, and Clerk URL vars (prefer the v6
`NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `…SIGN_UP_FALLBACK_REDIRECT_URL`
over the deprecated `AFTER_SIGN_IN/UP_URL`); `BLOB_READ_WRITE_TOKEN` (Vercel Blob);
`ADMIN_USER_IDS` (platform-admin allow-list); and the reminder vars `APP_BASE_URL`,
`WHATSAPP_*`, `CRON_SECRET`. (The former R2 keys are obsolete — image storage is
Vercel Blob.)

### Local dev notes

- **Neon branches:** a `production` branch (Vercel Production `DATABASE_URL`) and a
  `development` branch for local work. Local `apps/web/.env.local` and
  `packages/db/.env` point at the **`development`** branch; the production
  connection string lives only in the git-ignored `database-url.production.txt`
  (used for prod migrations). Never commit connection strings.
- **Webhooks need a tunnel** (ngrok / Clerk dev tunnel) to reach localhost; lazy
  sync covers the gap so you can develop without one.
- **Webhook harness**: `pnpm exec tsx scripts/test-webhook.ts [--role=OWNER --id=… --cleanup]`
  signs a mock `user.created` with the real secret and verifies the DB.

## Status / next steps

Core feature set is complete (auth, business, services with manual-approval,
availability + intraday breaks + blocked periods, duration-driven booking engine
with booking window, owner agenda, confirmation page with arrival tracking,
client portal, reviews, WhatsApp 24h reminders, Vercel Blob image storage).
Automated coverage now protects appointment status transitions, reminder policy,
phone normalization, and core input schemas. GitHub Actions runs types, lint,
and tests on pushes and pull requests. Natural follow-ups:

- **Integration coverage** — add an isolated PostgreSQL service in CI for booking
  concurrency, exclusion constraints, and authenticated tRPC flows.
- **Legal/accessibility review** — privacy, terms, and an honest accessibility
  statement are published with operator/contact details. Have the final wording
  reviewed professionally, add registration/address details before paid service,
  and publish full standards-compliance claims only after an accessibility audit.
- **Keep dev/prod branches in sync** — the `development` Neon branch now isolates
  local work; watch for schema drift between it and `production`.
- Optional: phone-match backfill for legacy guest bookings (re-add when there's
  data — a prior run was a no-op).
