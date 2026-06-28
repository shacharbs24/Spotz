import { SignIn } from "@clerk/nextjs";

/**
 * Catch-all sign-in route. Required because NEXT_PUBLIC_CLERK_SIGN_IN_URL is set
 * to "/sign-in" — Clerk routes OAuth (SSO) callbacks to "/sign-in/sso-callback",
 * which this optional catch-all segment handles.
 */
export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-6 py-16">
      <SignIn />
    </main>
  );
}
