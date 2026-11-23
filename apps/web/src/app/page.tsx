import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import { RoleSelect } from "@/components/landing/RoleSelect";
import { HeaderLoginButton } from "@/components/landing/HeaderLoginButton";
import { ClientPortal } from "@/components/portal/ClientPortal";
import { getServerCaller } from "@/trpc/server";

export default async function Home() {
  const { userId } = await auth();

  let role: "OWNER" | "CLIENT" | null = null;
  let fullName: string | null = null;
  if (userId) {
    const caller = await getServerCaller();
    const profile = await caller.me.getProfile();
    role = profile.role;
    fullName = profile.fullName;
  }

  // Owners skip the landing entirely — straight to their active dashboard.
  if (userId && role === "OWNER") {
    redirect("/dashboard");
  }

  const isClient = role === "CLIENT";

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col bg-surface"
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-8">
        <span className="flex items-center gap-2.5 text-xl font-bold leading-none">
          <Image
            src="/Spotz-profile.png"
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-md object-contain"
          />
          <bdi dir="ltr">
            Spotz<span className="text-owner">.</span>
          </bdi>
        </span>
        {userId ? <UserButton /> : <HeaderLoginButton />}
      </header>

      {!userId && (
        <section className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-8 px-4 py-8 sm:px-8 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20 lg:py-20">
          <div className="min-w-0">
            <h1 className="max-w-xl text-balance text-[2.25rem] leading-[1.1] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              קובעים תור.
              <br />
              מנהלים את היום.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-ink-muted sm:text-lg">
              מקום אחד לנהל בו את יומן העסק ולקבוע תור דרך הקישור שקיבלתם מהעסק.
            </p>
            <div className="mt-6 sm:mt-8">
              <RoleSelect />
            </div>
          </div>
          <AgendaPreview />
        </section>
      )}

      {userId && isClient && (
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
          <ClientPortal name={fullName} />
        </div>
      )}
    </main>
  );
}

function AgendaPreview() {
  return (
    <figure className="min-w-0 rounded-xl border border-line bg-surface-raised">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <span className="text-xl font-semibold">התורים של היום</span>
        <span className="text-sm text-ink-muted">יומן לדוגמה</span>
      </figcaption>
      <ul className="divide-y divide-line px-4 sm:px-6">
        {[
          {
            time: "09:00",
            service: "תספורת",
            status: "מאושר",
            tone: "bg-success-soft text-success",
          },
          {
            time: "10:30",
            service: "תספורת ועיצוב זקן",
            status: "ממתין",
            tone: "bg-pending-soft text-pending",
          },
          {
            time: "12:00",
            service: "עיצוב זקן",
            status: "מאושר",
            tone: "bg-success-soft text-success",
          },
        ].map(({ time, service, status, tone }) => (
          <li
            key={time}
            className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2.5 py-4 sm:gap-4"
          >
            <time
              dateTime={time}
              dir="ltr"
              className="text-start text-base font-semibold tabular-nums"
            >
              {time}
            </time>
            <span className="text-sm font-medium sm:text-base">{service}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
            >
              {status}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
