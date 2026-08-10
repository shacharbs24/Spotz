import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db, tables, eq } from "@spotz/db";
import { createClerkContext } from "@/trpc/context";

// Uses the DB + Clerk server SDK; never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 1_000_000; // 1MB ceiling — matches the client limit
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

/**
 * Mints a scoped, single-use client upload token for Vercel Blob. The browser
 * uploads the file bytes directly to Blob using this token, so image data never
 * passes through the serverless function or tRPC.
 *
 * Authorization is enforced here, not on the client:
 *   - caller must be an authenticated OWNER
 *   - if a businessId is supplied, it must be the caller's OWN business
 *     (one business per owner) — no minting tokens for someone else's business
 *   - Blob enforces the returned content-type allow-list and size cap
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { user } = await createClerkContext();
        if (!user || user.role !== "OWNER") {
          throw new Error("רק בעלי עסק יכולים להעלות תמונות.");
        }

        // The single business this owner owns (or none yet, when creating).
        const [owned] = await db
          .select({ id: tables.businesses.id })
          .from(tables.businesses)
          .where(eq(tables.businesses.ownerId, user.id));

        // The client may name the business the image is for. When present it
        // MUST be the caller's own — this is the cross-owner guard.
        let requestedBusinessId: string | null = null;
        if (clientPayload) {
          try {
            const parsed = JSON.parse(clientPayload) as { businessId?: string };
            requestedBusinessId = parsed.businessId ?? null;
          } catch {
            throw new Error("בקשת העלאה לא תקינה.");
          }
        }
        if (requestedBusinessId && requestedBusinessId !== owned?.id) {
          throw new Error("אפשר להעלות תמונות רק לעסק שלכם.");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
      // The URL is persisted through the OWNER-gated upsertBusiness mutation, so
      // nothing to do here (and this callback can't reach localhost anyway).
      onUploadCompleted: async () => {},
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
