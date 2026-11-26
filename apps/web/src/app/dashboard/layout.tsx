import type { ReactNode } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation";
import { requireDashboardOwner } from "@/trpc/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDashboardOwner();
  return (
    <div data-dashboard-shell className="flex flex-1 flex-col">
      <DashboardHeader />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 pb-10 sm:px-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-8">
        <DashboardNavigation />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex min-w-0 flex-col gap-6 lg:gap-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
