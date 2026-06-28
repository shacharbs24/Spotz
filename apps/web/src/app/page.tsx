import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { RoleSelect } from "@/components/landing/RoleSelect";
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

  const isClient = role === "CLIENT";

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-owner-soft blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-client-soft blur-3xl"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight text-ink">
          Spotz<span className="text-owner">.</span>
        </span>
        {userId ? (
          <div className="flex items-center gap-3">
            {role === "OWNER" && (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                לוח הבקרה
              </Link>
            )}
            <UserButton />
          </div>
        ) : (
          <SignInButton mode="modal">
            <button
              type="button"
              className="cursor-pointer text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              כבר יש לי חשבון
            </button>
          </SignInButton>
        )}
      </header>

      <section
        className={`relative z-10 mx-auto flex w-full flex-1 flex-col px-6 py-12 ${
          isClient
            ? "max-w-2xl"
            : "max-w-2xl items-center justify-center gap-10 text-center"
        }`}
      >
        {!userId && (
          <>
            <div className="flex flex-col items-center gap-5">
              <div className="relative h-40 w-40 sm:h-48 sm:w-48">
                <Image
                  src="/Spotz-prople.png"
                  alt="Spotz"
                  fill
                  priority
                  sizes="(min-width: 640px) 192px, 160px"
                  className="object-contain drop-shadow-sm"
                />
              </div>
              <span className="rounded-full border border-line bg-surface-raised px-4 py-1.5 text-xs font-medium text-ink-muted">
                תיאום תורים פשוט, לעסק ולכל לקוח
              </span>
              <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
                ברוכים הבאים ל־Spotz
              </h1>
              <p className="max-w-md text-balance text-base leading-7 text-ink-muted sm:text-lg">
                הדרך הקלה לקבוע ולנהל תורים. בחרו כיצד תרצו להתחיל.
              </p>
            </div>
            <RoleSelect />
          </>
        )}

        {userId && role === "OWNER" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface-raised px-8 py-7 shadow-soft">
            <p className="text-base text-ink">שמחים לראות אתכם שוב 👋</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
            >
              מעבר ללוח הבקרה
            </Link>
          </div>
        )}

        {userId && isClient && <ClientPortal name={fullName} />}
      </section>

      <footer className="relative z-10 mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} Spotz · מערכת לתיאום תורים
      </footer>
    </main>
  );
}
