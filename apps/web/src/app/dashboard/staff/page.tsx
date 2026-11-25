import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { StaffManager } from "@/components/dashboard/staff/StaffManager";
import { getServerCaller } from "@/trpc/server";

export default async function StaffPage() {
  const [{ userId }, caller] = await Promise.all([auth(), getServerCaller()]);
  if (!userId) redirect("/");
  const { role } = await caller.me.getProfile();
  if (role !== "OWNER") redirect("/");

  return (
    <div className="grid w-full max-w-3xl gap-6 sm:gap-8">
      <DashboardHeading
        title="צוות העסק"
        description="הוסיפו אנשי צוות כדי שלקוחות יוכלו לקבוע תור ביומן של כל אחד מהם."
      />
      <StaffManager />
    </div>
  );
}
