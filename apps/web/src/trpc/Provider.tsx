"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./client";

/** Resolves the absolute base URL for the tRPC endpoint across environments. */
function getBaseUrl(): string {
  // Browser: same-origin relative path.
  if (typeof window !== "undefined") return "";
  // Vercel deployment.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Local SSR fallback.
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

interface TRPCProviderProps {
  children: ReactNode;
}

/**
 * Wires the tRPC client and TanStack Query together. Both clients are created
 * once per app instance via `useState` so they survive re-renders without
 * leaking state between requests.
 */
export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000 },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: `${getBaseUrl()}/api/trpc` })],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
