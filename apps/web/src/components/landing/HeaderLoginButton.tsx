"use client";

import { useClerk } from "@clerk/nextjs";

/**
 * Header "already have an account" action. Opens Clerk's sign-in modal from a
 * native button `onClick` so the tap reliably fires on touch devices (avoids
 * relying on `<SignInButton>` cloning its child).
 */
export function HeaderLoginButton() {
  // Keep the Clerk instance intact — its methods depend on `this`, so a
  // destructured `openSignIn` would throw when called detached.
  const clerk = useClerk();

  const handleClick = () => {
    clerk.openSignIn({});
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ touchAction: "manipulation" }}
      className="-me-2 pointer-events-auto inline-flex min-h-11 cursor-pointer touch-manipulation items-center rounded-full px-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
    >
      כבר יש לי חשבון
    </button>
  );
}
