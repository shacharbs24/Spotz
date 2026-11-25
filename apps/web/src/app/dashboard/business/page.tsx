import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { BusinessForm } from "@/components/dashboard/BusinessForm";

export default async function BusinessSettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return (
    <div className="grid w-full max-w-2xl gap-6 sm:gap-8">
      <DashboardHeading
        title="פרטי העסק"
        description="הגדירו את פרטי העסק, הקישור הציבורי וחלון ההזמנות."
      />
      <BusinessForm />
    </div>
  );
}
