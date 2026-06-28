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
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const caller = await getServerCaller();
  const profile = await caller.me.getProfile();

  // Only allow internal redirect targets (avoid open redirect).
  const { redirect: redirectParam } = await searchParams;
  const redirectTo =
    redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          ברוכים הבאים 👋
        </h1>
        <p className="text-ink-muted">
          עוד פרט אחד לפני שמתחילים — נשמח לדעת איך ליצור איתכם קשר.
        </p>
      </div>

      <OnboardingForm
        defaultName={profile.fullName ?? ""}
        defaultPhone={profile.phone ?? ""}
        redirectTo={redirectTo}
      />
    </main>
  );
}
