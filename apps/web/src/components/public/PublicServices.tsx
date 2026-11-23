"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { formatDuration, formatPrice } from "@/lib/format";
import type { PublicService } from "@/trpc/types";
import { BookingModal } from "./BookingModal";

export type BookingAuthState = "guest" | "needs-onboarding" | "ready";

interface PublicServicesProps {
  businessId: string;
  services: PublicService[];
  maxBookingDate: string;
  /** Gate for the "קביעת תור" action — booking requires auth + onboarding. */
  authState: BookingAuthState;
  /** Public slug, used to return here after sign-in / onboarding. */
  slug: string;
  resumeServiceId?: string;
}

export function PublicServices({
  businessId,
  services,
  maxBookingDate,
  authState,
  slug,
  resumeServiceId,
}: PublicServicesProps) {
  const [activeServiceId, setActiveServiceId] = useState(resumeServiceId);
  const activeService =
    authState === "ready"
      ? services.find((service) => service.id === activeServiceId)
      : undefined;

  const closeBooking = () => {
    setActiveServiceId(undefined);
    const url = new URL(window.location.href);
    if (url.searchParams.has("booking")) {
      url.searchParams.delete("booking");
      window.history.replaceState(null, "", url);
      if (resumeServiceId === activeServiceId) {
        window.requestAnimationFrame(() =>
          document.getElementById(`book-${activeServiceId}`)?.focus(),
        );
      }
    }
  };

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-12 text-center text-ink-muted">
        השירותים יתווספו בקרוב.
      </div>
    );
  }

  return (
    <>
      {authState !== "ready" && (
        <p className="mb-4 text-sm text-ink-muted">
          {authState === "guest"
            ? "כדי לקבוע תור צריך להתחבר. לאחר הכניסה נחזור לשירות שבחרתם."
            : "לפני בחירת המועד צריך להשלים פרטי קשר. אחר כך נחזור לשירות שבחרתם."}
        </p>
      )}
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface-raised">
        {services.map((service) => (
          <li
            key={service.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-6 sm:px-5"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3
                id={`service-${service.id}`}
                className="text-base font-semibold break-words text-ink"
              >
                {service.name}
              </h3>
              <p className="text-sm text-ink-muted">
                {formatDuration(service.durationMinutes)}
              </p>
              {service.description && (
                <p className="text-sm leading-6 text-ink-muted">
                  {service.description}
                </p>
              )}
            </div>
            <bdi className="font-semibold whitespace-nowrap text-ink tabular-nums">
              {formatPrice(service.priceCents, service.currency)}
            </bdi>

            <div className="col-span-full sm:col-span-1">
              <BookingCta
                serviceId={service.id}
                authState={authState}
                returnUrl={`/b/${encodeURIComponent(slug)}?${new URLSearchParams({ booking: service.id })}`}
                onBook={() => setActiveServiceId(service.id)}
              />
            </div>
          </li>
        ))}
      </ul>

      {activeService && (
        <BookingModal
          open
          businessId={businessId}
          service={activeService}
          maxBookingDate={maxBookingDate}
          onClose={closeBooking}
        />
      )}
    </>
  );
}

const ctaClass = "action-primary w-full sm:w-auto";

function BookingCta({
  serviceId,
  authState,
  returnUrl,
  onBook,
}: {
  serviceId: string;
  authState: BookingAuthState;
  returnUrl: string;
  onBook: () => void;
}) {
  const serviceHeading = `service-${serviceId}`;

  // Guests must sign in first — Clerk modal returns them here afterwards.
  if (authState === "guest") {
    return (
      <SignInButton
        mode="modal"
        forceRedirectUrl={returnUrl}
        signUpForceRedirectUrl={returnUrl}
      >
        <button
          type="button"
          aria-describedby={serviceHeading}
          className={ctaClass}
        >
          התחברות לקביעת תור
        </button>
      </SignInButton>
    );
  }

  // Signed in but no phone yet — finish onboarding, then return here.
  if (authState === "needs-onboarding") {
    return (
      <Link
        href={`/onboarding?redirect=${encodeURIComponent(returnUrl)}`}
        aria-describedby={serviceHeading}
        className={ctaClass}
      >
        השלמת פרטים לקביעת תור
      </Link>
    );
  }

  return (
    <button
      id={`book-${serviceId}`}
      type="button"
      aria-describedby={serviceHeading}
      onClick={onBook}
      className={ctaClass}
    >
      קביעת תור
    </button>
  );
}
