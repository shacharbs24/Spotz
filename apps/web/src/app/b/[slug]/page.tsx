import Image from "next/image";
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
  searchParams: Promise<{ booking?: string | string[] }>;
}

export default async function PublicBusinessPage({
  params,
  searchParams,
}: PublicBusinessPageProps) {
  // slug, the tRPC caller, and the Clerk session are mutually independent.
  const [{ slug }, caller, { userId }, { booking }] = await Promise.all([
    params,
    getServerCaller(),
    auth(),
    searchParams,
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
  const resumeServiceId =
    authState === "ready" &&
    typeof booking === "string" &&
    services.some((service) => service.id === booking)
      ? booking
      : undefined;

  const location = [business.city, business.address]
    .filter(Boolean)
    .join(" · ");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col bg-surface"
    >
      <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6">
        <BackButton />
      </div>

      <header className="mx-auto grid w-full max-w-4xl items-start gap-5 px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {business.name}
          </h1>

          {business.description && (
            <p className="mt-2 max-w-xl text-base leading-7 text-ink-muted">
              {business.description}
            </p>
          )}

          {(location || business.phone) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
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
                  className="inline-flex min-h-11 items-center gap-1.5 transition-colors hover:text-ink"
                >
                  <PhoneIcon />
                  {business.phone}
                </a>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
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
            {services.length > 0 && (
              <a href="#services-heading" className="action-primary">
                לשירותים
              </a>
            )}
            <PublicReviewButton
              businessId={business.id}
              defaultName={viewerName}
            />
          </div>
        </div>

        {business.imageUrl && (
          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl md:aspect-[4/3] md:w-56">
            <Image
              src={business.imageUrl}
              alt={business.name}
              fill
              sizes="(min-width: 768px) 224px, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </header>

      <section
        id="services"
        aria-labelledby="services-heading"
        className="mx-auto w-full max-w-4xl flex-1 scroll-mt-4 px-4 pb-10 sm:px-6 sm:pb-14"
      >
        <h2
          id="services-heading"
          tabIndex={-1}
          className="mb-4 scroll-mt-4 text-xl font-semibold tracking-tight text-ink"
        >
          השירותים שלנו
        </h2>

        <PublicServices
          key={resumeServiceId ?? business.id}
          businessId={business.id}
          services={services}
          maxBookingDate={business.maxBookingDate}
          authState={authState}
          slug={slug}
          resumeServiceId={resumeServiceId}
        />
      </section>

      <BusinessReviews reviews={reviews} />
    </main>
  );
}

function PinIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
