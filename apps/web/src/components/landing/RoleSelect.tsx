"use client";

import { SignUpButton } from "@clerk/nextjs";
import type { ReactNode } from "react";

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
    title: "אני בעל עסק",
    blurb: "נהל את היומן, השירותים והתורים שלך במקום אחד.",
    redirectUrl: "/dashboard",
    accent: "owner",
    icon: <StoreIcon />,
  },
  {
    role: "CLIENT",
    title: "אני לקוח",
    blurb: "מצא עסק, בחר שירות וקבע תור בכמה הקשות.",
    redirectUrl: "/",
    accent: "client",
    icon: <CalendarIcon />,
  },
] as const;

/**
 * Two role cards. Each opens Clerk's sign-up modal carrying the chosen role in
 * `unsafeMetadata`, which Clerk forwards to the `user.created` webhook so the
 * role is persisted at account creation.
 */
export function RoleSelect() {
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      {ROLE_OPTIONS.map((option) => (
        <RoleCard key={option.role} option={option} />
      ))}
    </div>
  );
}

function RoleCard({ option }: { option: RoleOption }) {
  const isOwner = option.accent === "owner";
  const hoverBorder = isOwner
    ? "hover:border-owner focus-within:border-owner"
    : "hover:border-client focus-within:border-client";
  const chip = isOwner
    ? "bg-owner-soft text-owner"
    : "bg-client-soft text-client";
  const cta = isOwner ? "text-owner" : "text-client";

  return (
    <SignUpButton
      mode="modal"
      unsafeMetadata={{ role: option.role }}
      forceRedirectUrl={option.redirectUrl}
      signInForceRedirectUrl={option.redirectUrl}
    >
      <button
        type="button"
        className={`group flex h-full cursor-pointer flex-col items-start gap-4 rounded-2xl border border-line bg-surface-raised p-6 text-right shadow-soft transition-all duration-300 ease-out hover:-translate-y-1 ${hoverBorder}`}
      >
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${chip}`}
        >
          {option.icon}
        </span>
        <span className="flex flex-col gap-1.5">
          <span className="text-xl font-semibold tracking-tight text-ink">
            {option.title}
          </span>
          <span className="text-sm leading-6 text-ink-muted">
            {option.blurb}
          </span>
        </span>
        <span className={`mt-auto inline-flex items-center gap-1 text-sm font-medium ${cta}`}>
          המשך
          <ArrowIcon />
        </span>
      </button>
    </SignUpButton>
  );
}

function StoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      className="transition-transform duration-300 group-hover:-translate-x-1"
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
