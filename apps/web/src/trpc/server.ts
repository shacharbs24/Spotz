import "server-only";
import { appRouter } from "@spotz/api";
import { createClerkContext } from "./context";

/**
 * Server-side tRPC caller for React Server Components. Runs procedures
 * in-process (no HTTP round-trip) with the current Clerk identity in context,
 * including lazy user sync.
 */
export async function getServerCaller() {
  const ctx = await createClerkContext();
  return appRouter.createCaller(ctx);
}
