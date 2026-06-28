import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AvailabilityForm } from "@/components/dashboard/availability/AvailabilityForm";

export default async function AvailabilityPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-3">
        <nav className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/dashboard" className="transition-colors hover:text-ink">
            לוח הבקרה
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">שעות פעילות</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          שעות פעילות
        </h1>
        <p className="text-ink-muted">
          סמנו את הימים שבהם העסק פעיל והגדירו שעות פתיחה וסגירה. אלו ישמשו לחישוב
          התורים הפנויים.
        </p>
      </div>

      <AvailabilityForm />
    </main>
  );
}
