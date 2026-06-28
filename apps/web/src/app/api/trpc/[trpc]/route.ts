import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@spotz/api";
import { createClerkContext } from "@/trpc/context";

function handler(req: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createClerkContext,
  });
}

export { handler as GET, handler as POST };
