import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BusinessForm } from "@/components/dashboard/BusinessForm";

export default async function BusinessSettingsPage() {
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
          <span className="text-ink">העסק שלי</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          פרטי העסק
        </h1>
        <p className="text-ink-muted">
          הגדירו את שם העסק, הכתובת הציבורית ואזור הזמן. הכתובת תשמש לדף ההזמנות
          הציבורי שלכם.
        </p>
      </div>

      <BusinessForm />
    </main>
  );
}
