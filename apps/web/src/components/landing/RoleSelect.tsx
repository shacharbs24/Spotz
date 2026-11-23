"use client";

import { type ReactNode } from "react";
import { useClerk } from "@clerk/nextjs";

type Role = "OWNER" | "CLIENT";

interface RoleOption {
  role: Role;
  title: string;
  blurb: string;
  redirectUrl: string;
  accent: "owner" | "client";
  icon: ReactNode;
}

const ROLE_OPTIONS: readonly RoleOption[] = [
  {
    role: "OWNER",
    title: "הרשמה לבעלי עסקים",
    blurb: "נהלו את היומן, השירותים והתורים.",
    redirectUrl: "/dashboard",
    accent: "owner",
    icon: <StoreIcon />,
  },
  {
    role: "CLIENT",
    title: "הרשמה ללקוחות",
    blurb: "קבעו תור מקישור לעסק ועקבו אחריו.",
    redirectUrl: "/",
    accent: "client",
    icon: <CalendarIcon />,
  },
] as const;

/**
 * Two role cards. Each opens Clerk's sign-up modal carrying the chosen role in
 * `unsafeMetadata`, which Clerk forwards to the `user.created` webhook so the
 * role is persisted at account creation. The modal is opened programmatically
 * from a native button `onClick` (rather than wrapping the button in
 * `<SignUpButton>`) so the tap handler is guaranteed to fire on touch devices.
 */
export function RoleSelect() {
  return (
    <div className="grid w-full gap-2.5">
      {ROLE_OPTIONS.map((option) => (
        <RoleCard key={option.role} option={option} />
      ))}
    </div>
  );
}

function RoleCard({ option }: { option: RoleOption }) {
  // Keep the Clerk instance intact — do NOT destructure `openSignUp`. Its
  // methods rely on `this`, so a detached call throws internally and the modal
  // silently never opens.
  const clerk = useClerk();

  const isOwner = option.accent === "owner";
  const surface = isOwner
    ? "border-owner bg-owner text-white hover:border-owner-hover hover:bg-owner-hover"
    : "border-control bg-surface-raised text-ink hover:border-client hover:bg-client-soft";
  const chip = isOwner
    ? "bg-white/15 text-white"
    : "bg-client-soft text-client";

  const handleSelect = () => {
    clerk.openSignUp({
      unsafeMetadata: { role: option.role },
      forceRedirectUrl: option.redirectUrl,
      signInForceRedirectUrl: option.redirectUrl,
    });
  };

  return (
    <button
      type="button"
      onClick={handleSelect}
      className={`grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-3 text-start transition-colors duration-150 sm:px-4 ${surface}`}
    >
      <span className={`grid size-9 place-items-center rounded-lg ${chip}`}>
        {option.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold sm:text-lg">
          {option.title}
        </span>
        <span
          className={`text-sm leading-5 ${isOwner ? "text-white/90" : "text-ink-muted"}`}
        >
          {option.blurb}
        </span>
      </span>
      <ArrowIcon />
    </button>
  );
}

function StoreIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 9.5 4.5 4h15L21 9.5M4 9.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-9Zm0 0a2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3.5 9.5h17M8 3v4m8-4v4m-7.5 8 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* RTL: arrow points left */}
      <path
        d="M14 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
