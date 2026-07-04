import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { TodayAppointments } from "@/components/dashboard/appointments/TodayAppointments";
import { getServerCaller } from "@/trpc/server";

const DASHBOARD_CARDS: readonly {
  label: string;
  hint: string;
  href: string;
}[] = [
  { label: "העסק שלי", hint: "הגדרת פרטי העסק", href: "/dashboard/business" },
  { label: "שירותים", hint: "ניהול השירותים", href: "/dashboard/services" },
  { label: "שעות פעילות", hint: "הגדרת שעות הפעילות", href: "/dashboard/availability" },
  { label: "תורים", hint: "צפייה בכל התורים", href: "/dashboard/appointments" },
  { label: "חסימות ביומן", hint: "חופשות וחסימות", href: "/dashboard/blocked" },
];

/**
 * Owner dashboard landing. Renders the active view directly — today's agenda up
 * top so it's visible without drilling into a submenu, with the management
 * modules below. The full multi-day agenda stays reachable via the "תורים" card.
 */
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  // Owner-only route — clients are sent back to their home portal.
  const caller = await getServerCaller();
  const { role } = await caller.me.getProfile();
  if (role !== "OWNER") {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-line pb-5">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">
          Spotz<span className="text-owner">.</span>
        </Link>
        <UserButton />
      </header>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink">לוח הבקרה</h1>
        <p className="text-ink-muted">ניהול העסק, השירותים והתורים שלך.</p>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            התורים של היום
          </h2>
          <Link
            href="/dashboard/appointments"
            className="inline-flex items-center gap-1 text-sm font-medium text-owner transition-colors hover:text-owner/80"
          >
            לכל התורים
            <span aria-hidden="true">←</span>
          </Link>
        </div>
        <TodayAppointments />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink-muted">ניהול</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARD_CARDS.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="group rounded-2xl border border-line bg-surface-raised p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-owner"
            >
              <p className="font-medium text-ink">{card.label}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-owner">
                {card.hint}
                <span className="transition-transform duration-300 group-hover:-translate-x-1">
                  ←
                </span>
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
