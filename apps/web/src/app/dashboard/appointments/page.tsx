import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { AppointmentsList } from "@/components/dashboard/appointments/AppointmentsList";

export default async function AppointmentsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return (
    <div className="grid w-full min-w-0 max-w-3xl grid-cols-1 gap-6 sm:gap-8">
      <DashboardHeading
        title="כל התורים"
        description="בחרו תאריך כדי לראות את התורים לפי שעה ולעדכן את הסטטוס שלהם."
      />
      <AppointmentsList />
    </div>
  );
}
