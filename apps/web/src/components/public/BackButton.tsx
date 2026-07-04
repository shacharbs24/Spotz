"use client";

import { useRouter } from "next/navigation";

/**
 * Ghost "back" control for public business pages. Returns via browser history
 * when there is any (e.g. a signed-in client coming from their portal), and
 * falls back to the home/portal for visitors who arrived through a shared link
 * with no in-app history to pop.
 */
export function BackButton() {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-line/60 hover:text-ink"
    >
      <BackArrowIcon />
      חזרה
    </button>
  );
}

function BackArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* RTL: "back" points right */}
      <path
        d="M10 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
