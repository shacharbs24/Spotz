import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
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
    <div className="grid w-full max-w-3xl gap-6 sm:gap-8">
      <DashboardHeading
        title="היסטוריית תורים"
        description="חפשו לפי שם לקוח כדי לאתר תור שהסתיים, בוטל או עבר."
      />
      <HistoryList />
    </div>
  );
}
