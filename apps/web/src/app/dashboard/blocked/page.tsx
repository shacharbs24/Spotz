import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { BlockedPeriodsManager } from "@/components/dashboard/blocked/BlockedPeriodsManager";

export default async function BlockedPeriodsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return (
    <div className="grid w-full max-w-2xl gap-6 sm:gap-8">
      <DashboardHeading
        title="חסימות ביומן"
        description="חסמו ימי חופשה או שעות שלא תרצו להציע להזמנה."
      />
      <BlockedPeriodsManager />
    </div>
  );
}
