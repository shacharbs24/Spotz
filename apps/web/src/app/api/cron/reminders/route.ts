import { sendDueAppointmentReminders } from "@spotz/api/reminders";

// Server-only; touches the DB + external API, never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron endpoint that dispatches 24h WhatsApp reminders.
 *
 *   Authorization: Bearer ${CRON_SECRET}   (required)
 *   ?dryRun=1                              (optional — report without sending)
 *
 * Accepts GET or POST so it works with most cron providers.
 */
async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  try {
    const summary = await sendDueAppointmentReminders({ dryRun });
    // One-line run summary so skipped/failed sends are visible in cron logs
    // instead of being silent.
    console.log(
      `[reminders]${dryRun ? " (dry-run)" : ""} attempted=${summary.considered} sent=${summary.sent} skipped=${summary.skipped} failed=${summary.failed} duplicates=${summary.duplicates}`,
    );
    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export { handle as GET, handle as POST };
