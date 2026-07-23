import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { getServerCaller } from "@/trpc/server";

/** Appointment status → Hebrew label + badge classes (matches the dashboard). */
const STATUS_META: Record<
  "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED",
  { label: string; badge: string }
> = {
  PENDING: { label: "ממתין", badge: "bg-pending-soft text-pending" },
  CONFIRMED: { label: "מאושר", badge: "bg-success-soft text-success" },
  CANCELLED: { label: "מבוטל", badge: "bg-danger-soft text-danger" },
  COMPLETED: { label: "הושלם", badge: "bg-owner-soft text-owner" },
};

const STATUS_ORDER = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

/**
 * Loads the admin overview, translating the adminProcedure's FORBIDDEN into
 * "no such page" so the route stays undiscoverable to non-admins. Genuine
 * failures (e.g. DB errors) are rethrown so they surface as 500s, not 404s.
 */
async function loadAdminOverview() {
  const caller = await getServerCaller();
  try {
    return await caller.admin.getOverview();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      return null;
    }
    throw error;
  }
}

export default async function AdminPage() {
  const data = await loadAdminOverview();
  if (!data) {
    notFound();
  }

  const { totals, appointmentsByStatus, businesses } = data;

  const summaryCards: readonly { label: string; value: number }[] = [
    { label: "עסקים", value: totals.businesses },
    { label: "משתמשים", value: totals.users },
    { label: "תורים", value: totals.appointments },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2 border-b border-line pb-5">
        <p className="text-sm font-medium tracking-wide text-owner">Spotz</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          סקירת פלטפורמה
        </h1>
        <p className="text-ink-muted">נתונים כלל-מערכתיים על העסקים והתורים.</p>
      </header>

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-line bg-surface-raised p-6 shadow-soft"
          >
            <p className="text-sm text-ink-muted">{card.label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
              {card.value.toLocaleString("he-IL")}
            </p>
          </div>
        ))}
      </section>

      {/* Appointments by status */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink-muted">תורים לפי סטטוס</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft"
            >
              <span
                className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_META[status].badge}`}
              >
                {STATUS_META[status].label}
              </span>
              <p className="text-2xl font-bold tracking-tight text-ink">
                {appointmentsByStatus[status].toLocaleString("he-IL")}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Per-business table */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          עסקים ({businesses.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface-raised shadow-soft">
          <table className="w-full min-w-[36rem] text-right text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="px-5 py-3 font-medium">עסק</th>
                <th className="px-5 py-3 font-medium">לקוחות</th>
                <th className="px-5 py-3 font-medium">תורים</th>
                <th className="px-5 py-3 font-medium">נוצר</th>
              </tr>
            </thead>
            <tbody>
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-ink-muted">
                    אין עדיין עסקים.
                  </td>
                </tr>
              ) : (
                businesses.map((business) => (
                  <tr
                    key={business.id}
                    className="border-b border-line last:border-b-0 transition-colors hover:bg-surface"
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-ink">
                          {business.name}
                        </span>
                        <span dir="ltr" className="text-xs text-ink-muted">
                          /b/{business.slug}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-ink">
                      {business.clientCount.toLocaleString("he-IL")}
                    </td>
                    <td className="px-5 py-4 font-semibold text-ink">
                      {business.appointmentCount.toLocaleString("he-IL")}
                    </td>
                    <td className="px-5 py-4 text-ink-muted">
                      {business.createdDate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
