import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { ServicesManager } from "@/components/dashboard/services/ServicesManager";

export default async function ServicesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return (
    <div className="grid w-full max-w-3xl gap-6 sm:gap-8">
      <DashboardHeading
        title="השירותים שלי"
        description="נהלו את השירותים, משך הטיפול והמחירים שמוצגים בדף ההזמנות."
      />
      <ServicesManager />
    </div>
  );
}
