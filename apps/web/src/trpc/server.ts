import "server-only";
import { appRouter } from "@spotz/api";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClerkContext } from "./context";

/**
 * Server-side tRPC caller for React Server Components. Runs procedures
 * in-process (no HTTP round-trip) with the current Clerk identity in context,
 * including lazy user sync.
 */
export const getServerCaller = cache(async () => {
  const ctx = await createClerkContext();
  return appRouter.createCaller(ctx);
});

export const requireDashboardOwner = cache(async () => {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const caller = await getServerCaller();
  const profile = await caller.me.getProfile();
  if (profile.role !== "OWNER") redirect("/");
  if (!profile.ownerAccessGranted) redirect("/owner-approval");
  return caller;
});
