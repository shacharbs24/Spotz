import { del } from "@vercel/blob";

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * True only for URLs we manage in Vercel Blob. External or legacy http(s) URLs
 * (and any pre-migration data: values) return false, so they're never touched.
 */
export function isBlobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/**
 * Deletes a Blob if — and only if — the URL is one we manage. No-ops on
 * external/legacy URLs and swallows errors: orphan cleanup must never fail the
 * write that triggered it.
 */
export async function deleteManagedBlob(
  url: string | null | undefined,
): Promise<void> {
  if (!isBlobUrl(url)) return;
  try {
    await del(url as string);
  } catch (error) {
    console.error("Failed to delete old business image blob", error);
  }
}
