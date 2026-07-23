import { router, publicProcedure } from "./trpc";
import { businessesRouter } from "./routers/businesses";
import { servicesRouter } from "./routers/services";
import { availabilityRouter } from "./routers/availability";
import { appointmentsRouter } from "./routers/appointments";
import { blocksRouter } from "./routers/blocks";
import { meRouter } from "./routers/me";
import { reviewsRouter } from "./routers/reviews";
import { publicRouter } from "./routers/public";

export type { Context, AuthUser } from "./trpc";
export { router, publicProcedure, protectedProcedure } from "./trpc";

/** Root application router. Add feature routers here. */
export const appRouter = router({
  /** Lightweight wiring/health check — verifies the tRPC pipeline end to end. */
  health: publicProcedure.query(() => ({
    ok: true,
    timestamp: new Date().toISOString(),
  })),
  businesses: businessesRouter,
  services: servicesRouter,
  availability: availabilityRouter,
  appointments: appointmentsRouter,
  blocks: blocksRouter,
  me: meRouter,
  reviews: reviewsRouter,
  public: publicRouter,
});

export type AppRouter = typeof appRouter;
