/**
 * Migration: move business images out of the DB (base64 data-URIs) into Vercel
 * Blob, replacing image_url with the hosted URL.
 *
 * SAFETY: dry-run by default — prints what it would do and writes nothing.
 * Pass --execute to actually upload + update.
 *
 *   # dry run against an arbitrary DB
 *   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_…" \
 *   pnpm exec tsx scripts/migrate-business-images-to-blob.ts --database-url="postgres://…"
 *
 *   # execute for real
 *   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_…" \
 *   pnpm exec tsx scripts/migrate-business-images-to-blob.ts --database-url="postgres://…" --execute
 *
 * Idempotent: only rows whose image_url is a data: URI are processed; migrated
 * rows (http URLs) are skipped, so re-running is safe.
 */
import { eq, like } from "drizzle-orm";
import { put } from "@vercel/blob";

function getFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function parseDataUrl(
  dataUrl: string,
): { contentType: string; buffer: Buffer } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1] || "application/octet-stream";
  const buffer = m[2]
    ? Buffer.from(m[3], "base64")
    : Buffer.from(decodeURIComponent(m[3]), "utf8");
  return { contentType, buffer };
}

async function main() {
  const execute = process.argv.includes("--execute");
  const dryRun = !execute;

  // Resolve the target DB: explicit flag wins, else ambient env. We deliberately
  // do NOT load apps/web/.env.local here.
  const databaseUrl = getFlag("database-url") ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail(
      'No database URL. Pass --database-url="postgres://…" or set DATABASE_URL in the environment.',
    );
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    fail("BLOB_READ_WRITE_TOKEN is not set — required to upload to Vercel Blob.");
  }
  // @spotz/db reads process.env.DATABASE_URL at import time — set it first.
  process.env.DATABASE_URL = databaseUrl;

  const { db, tables } = await import("@spotz/db");

  const mode = dryRun ? "DRY RUN (no changes)" : "EXECUTE (writing)";
  const host = (() => {
    try {
      return new URL(databaseUrl).host;
    } catch {
      return "(unparseable url)";
    }
  })();
  console.log(`\n=== migrate business images → Blob — ${mode} ===`);
  console.log(`target host: ${host}\n`);

  const rows = await db
    .select({
      id: tables.businesses.id,
      imageUrl: tables.businesses.imageUrl,
    })
    .from(tables.businesses)
    .where(like(tables.businesses.imageUrl, "data:%"));

  console.log(`base64 rows to migrate: ${rows.length}`);
  for (const r of rows) {
    const parsed = parseDataUrl(r.imageUrl as string);
    const kb = parsed ? Math.round(parsed.buffer.length / 1024) : 0;
    console.log(
      `  ${r.id}  ${parsed?.contentType ?? "(unparseable)"}  ~${kb}KB`,
    );
  }

  if (dryRun) {
    console.log("\nDRY RUN — nothing written. Re-run with --execute to apply.\n");
    process.exit(0);
  }

  console.log("\nuploading + updating…");
  let migrated = 0;
  let skipped = 0;
  for (const r of rows) {
    const parsed = parseDataUrl(r.imageUrl as string);
    if (!parsed) {
      console.warn(`  ⚠ ${r.id} — unparseable data URI, skipped`);
      skipped++;
      continue;
    }
    const ext = EXT_BY_TYPE[parsed.contentType] ?? "bin";
    const result = await put(`businesses/${r.id}.${ext}`, parsed.buffer, {
      access: "public",
      contentType: parsed.contentType,
      addRandomSuffix: true,
      token,
    });
    await db
      .update(tables.businesses)
      .set({ imageUrl: result.url })
      .where(eq(tables.businesses.id, r.id));
    console.log(`  ✓ ${r.id} → ${result.url}`);
    migrated++;
  }

  console.log(`\n✓ done. migrated=${migrated} skipped=${skipped}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
