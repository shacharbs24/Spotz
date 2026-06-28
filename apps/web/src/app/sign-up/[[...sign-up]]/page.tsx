import { SignUp } from "@clerk/nextjs";

/**
 * Catch-all sign-up route. Required because NEXT_PUBLIC_CLERK_SIGN_UP_URL is set
 * to "/sign-up" — Clerk routes OAuth (SSO) callbacks to "/sign-up/sso-callback",
 * which this optional catch-all segment handles. The role chosen via the
 * landing-page modal (unsafeMetadata) is preserved across the OAuth redirect.
 */
export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-6 py-16">
      <SignUp />
    </main>
  );
}
