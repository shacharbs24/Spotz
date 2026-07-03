import { StarRating } from "@/components/ui/StarRating";
import type { BusinessReview } from "@/trpc/types";

/** Visible reviews list for the public business page (presentational, RSC). */
export function BusinessReviews({ reviews }: { reviews: BusinessReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 sm:pb-20">
      <h2 className="mb-5 text-lg font-semibold tracking-tight text-ink">
        חוות דעת
      </h2>
      <ul className="flex flex-col gap-4">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 break-words font-semibold tracking-tight text-ink">
                {review.reviewerName}
              </span>
              <StarRating value={review.rating} />
            </div>
            {review.comment && (
              <p className="text-sm leading-6 text-ink-muted">
                {review.comment}
              </p>
            )}
            <span className="text-xs text-ink-muted">{review.date}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
