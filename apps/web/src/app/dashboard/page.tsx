import Link from "next/link";
import { TodayAppointments } from "@/components/dashboard/appointments/TodayAppointments";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { requireDashboardOwner } from "@/trpc/server";

export default async function DashboardPage() {
  const caller = await requireDashboardOwner();
  const business = await caller.businesses.getMyBusiness();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DashboardHeading
          title="לוח הבקרה"
          description={business?.name ?? "הגדרה ראשונית של העסק"}
        />
        {business && <CopyLinkButton slug={business.slug} />}
      </div>

      {business ? (
        <TodayAppointments />
      ) : (
        <section className="flex flex-col items-start gap-3 rounded-xl border border-line bg-surface-raised p-5 sm:p-6">
          <h2 className="text-xl font-semibold">מגדירים את העסק</h2>
          <p className="text-ink-muted">
            הגדירו את פרטי העסק כדי להתחיל להציג שירותים ולקבל תורים.
          </p>
          <Link href="/dashboard/business" className="action-primary">
            הגדרת פרטי העסק
          </Link>
        </section>
      )}
    </>
  );
}
