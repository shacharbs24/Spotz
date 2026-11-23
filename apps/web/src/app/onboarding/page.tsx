import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getServerCaller } from "@/trpc/server";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

interface OnboardingPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  // Session, caller, and search params are independent — resolve together.
  const [{ userId }, caller, { redirect: redirectParam }] = await Promise.all([
    auth(),
    getServerCaller(),
    searchParams,
  ]);
  if (!userId) {
    redirect("/");
  }

  const profile = await caller.me.getProfile();

  // Only allow internal redirect targets (avoid open redirect).
  const redirectTo =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";
  const returningToBooking = redirectTo.startsWith("/b/");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          השלמת פרטי קשר
        </h1>
        <p className="text-ink-muted">
          {returningToBooking
            ? "הוסיפו שם וטלפון כדי שהעסק יוכל ליצור קשר לגבי התור. לאחר השמירה נחזור לשירות שבחרתם."
            : "הוסיפו שם וטלפון כדי שנוכל לזהות אתכם בתורים שתקבעו."}
        </p>
      </div>

      <OnboardingForm
        defaultName={profile.fullName ?? ""}
        defaultPhone={profile.phone ?? ""}
        redirectTo={redirectTo}
        returningToBooking={returningToBooking}
      />
    </main>
  );
}
