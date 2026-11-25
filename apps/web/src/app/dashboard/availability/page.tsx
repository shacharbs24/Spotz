import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { AvailabilityForm } from "@/components/dashboard/availability/AvailabilityForm";

export default async function AvailabilityPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return (
    <div className="grid w-full max-w-2xl gap-6 sm:gap-8">
      <DashboardHeading
        title="שעות פעילות"
        description="בחרו באילו ימים ושעות לקוחות יכולים לקבוע תור."
      />
      <AvailabilityForm />
    </div>
  );
}
