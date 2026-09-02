# Spotz

Spotz is a Hebrew-first appointment-booking platform for small businesses.
Owners manage their business, services, availability, calendar blocks, and
appointments. Signed-in clients book through a public `/b/[slug]` page and use
their portal to view, cancel, and review appointments.

## Stack

- Turborepo + pnpm workspaces, Node.js 20+
- Next.js 16 App Router + React 19 + Tailwind CSS 4
- tRPC 11 + TanStack Query + Zod
- PostgreSQL/Neon + Drizzle ORM
- Clerk authentication
- Vercel Blob for business images
- Meta WhatsApp Cloud API for appointment reminders

## Workspace

```text
apps/web       Next.js product and HTTP routes
packages/api   tRPC routers, validation, booking logic, reminders
packages/db    Drizzle schema, database client, and migrations
scripts        One-off migrations and the Clerk webhook harness
```

The dependency flow is `apps/web -> @spotz/api -> @spotz/db -> PostgreSQL`.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data model and full request
flows.

## Local development

```bash
pnpm install
pnpm dev
```

The web app reads local secrets from `apps/web/.env.local`. At minimum, local
development requires the Clerk keys and `DATABASE_URL`. Do not commit `.env*`,
database URLs, or provider credentials.

## Verification

```bash
pnpm check-types
pnpm lint
pnpm test
pnpm build
```

`pnpm test` runs the API's fast, database-free unit suite. It covers appointment
status transitions, reminder timing/retries and tokenized URLs, Israeli phone
normalization, and the core booking/business schemas. GitHub Actions runs type
checks, lint, and these tests on every push and pull request.

The Clerk webhook also has a manual integration harness:

```bash
pnpm exec tsx scripts/test-webhook.ts --cleanup
```

## Database

```bash
pnpm --filter @spotz/db db:generate
pnpm --filter @spotz/db db:migrate
pnpm --filter @spotz/db db:studio
```

Run migrations against the development database first. Production migrations
should use an explicitly supplied production `DATABASE_URL`.
