"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { formatPrice } from "@/lib/format";
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
}

export function PublicServices({
  businessId,
  services,
  maxBookingDate,
  authState,
  slug,
}: PublicServicesProps) {
  const [activeService, setActiveService] = useState<PublicService | null>(null);

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-12 text-center text-ink-muted">
        השירותים יתווספו בקרוב.
      </div>
    );
  }

  const returnUrl = `/b/${slug}`;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {services.map((service) => (
          <li
            key={service.id}
            className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-owner/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold tracking-tight text-ink">
                  {service.name}
                </h3>
                {service.description && (
                  <p className="text-sm leading-6 text-ink-muted">
                    {service.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-owner-soft px-3 py-1 text-sm font-semibold text-owner">
                {formatPrice(service.priceCents, service.currency)}
              </span>
            </div>

            <div className="flex items-center justify-end">
              <BookingCta
                authState={authState}
                returnUrl={returnUrl}
                onBook={() => setActiveService(service)}
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
          onClose={() => setActiveService(null)}
        />
      )}
    </>
  );
}

const ctaClass =
  "cursor-pointer rounded-full bg-owner px-5 py-1.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]";

function BookingCta({
  authState,
  returnUrl,
  onBook,
}: {
  authState: BookingAuthState;
  returnUrl: string;
  onBook: () => void;
}) {
  // Guests must sign in first — Clerk modal returns them here afterwards.
  if (authState === "guest") {
    return (
      <SignInButton mode="modal" forceRedirectUrl={returnUrl}>
        <button type="button" className={ctaClass}>
          קביעת תור
        </button>
      </SignInButton>
    );
  }

  // Signed in but no phone yet — finish onboarding, then return here.
  if (authState === "needs-onboarding") {
    return (
      <Link
        href={`/onboarding?redirect=${encodeURIComponent(returnUrl)}`}
        className={ctaClass}
      >
        קביעת תור
      </Link>
    );
  }

  return (
    <button type="button" onClick={onBook} className={ctaClass}>
      קביעת תור
    </button>
  );
}
