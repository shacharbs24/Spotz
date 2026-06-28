import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const DASHBOARD_CARDS: readonly {
  label: string;
  hint: string;
  href: string | null;
}[] = [
  { label: "העסק שלי", hint: "הגדרת פרטי העסק", href: "/dashboard/business" },
  { label: "שירותים", hint: "ניהול השירותים", href: "/dashboard/services" },
  { label: "שעות פעילות", hint: "הגדרת שעות הפעילות", href: "/dashboard/availability" },
  { label: "תורים", hint: "צפייה בתורים", href: "/dashboard/appointments" },
  { label: "חסימות ביומן", hint: "חופשות וחסימות", href: "/dashboard/blocked" },
];

/**
 * Placeholder owner dashboard. Real business/service/appointment management
 * lands here once the feature routers exist. For now it just confirms the
 * authenticated landing target for OWNER sign-ups.
 */
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DASHBOARD_CARDS.map((card) =>
          card.href ? (
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
          ) : (
            <div
              key={card.label}
              className="rounded-2xl border border-dashed border-line bg-surface-raised p-6 text-ink-muted"
            >
              <p className="font-medium text-ink">{card.label}</p>
              <p className="mt-1 text-sm">{card.hint}</p>
            </div>
          ),
        )}
      </section>
    </main>
  );
}
