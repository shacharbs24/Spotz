import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@spotz/api";

/**
 * Typed tRPC React client. Hooks (`trpc.health.useQuery()`, etc.) are inferred
 * from the server `AppRouter`, so the client stays in sync with the API surface.
 */
export const trpc = createTRPCReact<AppRouter>();
