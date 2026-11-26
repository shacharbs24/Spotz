import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RefreshOwnerApproval } from "@/components/dashboard/RefreshOwnerApproval";
import { legalDetails } from "@/lib/legal";
import { getServerCaller } from "@/trpc/server";

export default async function OwnerApprovalPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");
  const caller = await getServerCaller();
  const profile = await caller.me.getProfile();
  if (profile.role !== "OWNER") redirect("/");
  if (profile.ownerAccessGranted) redirect("/dashboard");

  const contactPhone = await caller.me.getOwnerApprovalContact();

  return (
    <>
      <DashboardHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 sm:py-16"
      >
        <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft sm:p-8">
          <div className="grid gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              ממתינים לאישור מנהל
            </h1>
            <p className="leading-7 text-ink-muted">
              חשבון העסק ייפתח לאחר אישור מנהל Spotz. בדיקת הבקשה אורכת עד שני
              ימי עסקים.
            </p>
          </div>
          <div className="grid gap-1 border-y border-line py-3">
            <h2 className="text-sm font-semibold">ליצירת קשר</h2>
            {contactPhone ? (
              <a
                href={`tel:+${contactPhone}`}
                className="inline-flex min-h-11 items-center justify-self-start rounded-lg font-semibold text-owner underline underline-offset-4"
              >
                <bdi dir="ltr">0{contactPhone.slice(3)}</bdi>
              </a>
            ) : (
              <a
                href={`mailto:${legalDetails.contactEmail}`}
                className="inline-flex min-h-11 items-center justify-self-start rounded-lg font-semibold break-all text-owner underline underline-offset-4"
              >
                <bdi dir="ltr">{legalDetails.contactEmail}</bdi>
              </a>
            )}
          </div>
          <RefreshOwnerApproval />
        </section>
      </main>
    </>
  );
}
