import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getServerCaller } from "@/trpc/server";
import { PublicServices } from "@/components/public/PublicServices";
import { BusinessReviews } from "@/components/public/BusinessReviews";
import { PublicReviewButton } from "@/components/public/PublicReviewButton";
import { BackButton } from "@/components/public/BackButton";
import { StarRating } from "@/components/ui/StarRating";

interface PublicBusinessPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicBusinessPage({
  params,
}: PublicBusinessPageProps) {
  // slug, the tRPC caller, and the Clerk session are mutually independent.
  const [{ slug }, caller, { userId }] = await Promise.all([
    params,
    getServerCaller(),
    auth(),
  ]);
  const data = await caller.public.getBusinessBySlug({ slug });

  if (!data) {
    notFound();
  }

  const { business, services } = data;
  // Rating summary + reviews depend only on business.id; the viewer profile
  // depends only on userId — all three are independent, so fetch in parallel.
  const [ratingSummary, reviews, profile] = await Promise.all([
    caller.reviews.getBusinessRatingSummary({ businessId: business.id }),
    caller.reviews.getBusinessReviews({ businessId: business.id }),
    userId ? caller.me.getProfile() : Promise.resolve(null),
  ]);
  const viewerName = profile?.fullName ?? "";
  const authState: "guest" | "needs-onboarding" | "ready" = !userId
    ? "guest"
    : !profile?.phone
      ? "needs-onboarding"
      : "ready";

  const location = [business.city, business.address]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-surface">
      {/* Atmospheric glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-owner-soft blur-3xl"
      />

      {/* Back to the client's portal / previous page */}
      <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        <BackButton />
      </div>

      {/* 1. Business image — prominent cover at the very top */}
      {business.imageUrl ? (
        <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={business.imageUrl}
            alt={business.name}
            className="h-48 w-full rounded-2xl border border-line object-cover shadow-soft sm:h-72"
          />
        </div>
      ) : null}

      {/* Title + 2. description immediately below */}
      <header className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-6 pb-8 text-center sm:px-6 sm:pt-8">
        {!business.imageUrl && (
          <p className="mb-4 text-sm font-medium tracking-wide text-owner">
            קביעת תור אונליין
          </p>
        )}

        <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-5xl">
          {business.name}
        </h1>

        {business.description && (
          <p className="mx-auto mt-4 max-w-xl text-balance text-base leading-7 text-ink-muted">
            {business.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <PinIcon />
              {location}
            </span>
          )}
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              dir="ltr"
              className="inline-flex min-h-8 items-center gap-1.5 transition-colors hover:text-ink"
            >
              <PhoneIcon />
              {business.phone}
            </a>
          )}
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
          {ratingSummary.reviewCount > 0 && (
            <div className="inline-flex items-center gap-2 text-sm text-ink">
              <StarRating value={ratingSummary.averageRating} />
              <span className="font-semibold">
                {ratingSummary.averageRating}
              </span>
              <span className="text-ink-muted">
                מתוך 5 · {ratingSummary.reviewCount} חוות דעת
              </span>
            </div>
          )}
          <PublicReviewButton businessId={business.id} defaultName={viewerName} />
        </div>
      </header>

      {/* Services */}
      <section className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pb-16 sm:px-6 sm:pb-20">
        <h2 className="mb-5 text-lg font-semibold tracking-tight text-ink">
          השירותים שלנו
        </h2>

        <PublicServices
          businessId={business.id}
          services={services}
          maxBookingDate={business.maxBookingDate}
          authState={authState}
          slug={slug}
        />
      </section>

      <BusinessReviews reviews={reviews} />

      <footer className="relative z-10 mx-auto w-full max-w-3xl px-4 py-6 text-center text-xs text-ink-muted sm:px-6">
        מופעל על־ידי Spotz
      </footer>
    </main>
  );
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
