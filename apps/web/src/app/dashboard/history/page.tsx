import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HistoryList } from "@/components/dashboard/history/HistoryList";
import { getServerCaller } from "@/trpc/server";

export default async function HistoryPage() {
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-3">
        <nav className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/dashboard" className="transition-colors hover:text-ink">
            לוח הבקרה
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-ink">היסטוריית תורים</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          היסטוריית תורים
        </h1>
        <p className="text-ink-muted">
          תורים שהסתיימו, בוטלו או עברו. חפשו לפי שם לקוח כדי לאתר תור מהעבר.
        </p>
      </div>

      <HistoryList />
    </main>
  );
}
