import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppointmentsList } from "@/components/dashboard/appointments/AppointmentsList";

export default async function AppointmentsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-3">
        <nav className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/dashboard" className="transition-colors hover:text-ink">
            לוח הבקרה
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">התורים שלי</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          התורים שלי
        </h1>
        <p className="text-ink-muted">
          סדר היום שלכם — בחרו תאריך וצפו בתורים לפי שעה. אשרו, סמנו כהושלם או
          בטלו לפי הצורך.
        </p>
      </div>

      <AppointmentsList />
    </main>
  );
}
