import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TodayAppointments } from "@/components/dashboard/appointments/TodayAppointments";
import { CopyLinkButton } from "@/components/dashboard/CopyLinkButton";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { getServerCaller } from "@/trpc/server";

export default async function DashboardPage() {
  const [{ userId }, caller] = await Promise.all([auth(), getServerCaller()]);
  if (!userId) {
    redirect("/");
  }

  // Owner-only route — clients are sent back to their home portal. The profile
  // (role gate) and the business load are independent, so fetch them together;
  // getMyBusiness returns null for a non-owner, so the eager fetch is harmless.
  const [{ role }, business] = await Promise.all([
    caller.me.getProfile(),
    caller.businesses.getMyBusiness(),
  ]);
  if (role !== "OWNER") {
    redirect("/");
  }

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
