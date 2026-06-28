/**
 * Read-only star rating display. Presentational (no client hooks) so it renders
 * in both Server and Client components. Stars fill up to the rounded value.
 */
export function StarRating({
  value,
  size = 16,
}: {
  value: number;
  size?: number;
}) {
  const filled = Math.round(value);
  return (
    <span
      dir="ltr"
      className="inline-flex items-center gap-0.5"
      aria-label={`${value} מתוך 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= filled} size={size} />
      ))}
    </span>
  );
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      className={filled ? "text-pending" : "text-line"}
      aria-hidden="true"
    >
      <path d="M12 2.6l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 18.66l-5.9 3.11 1.13-6.57L2.45 9.54l6.6-.96L12 2.6z" />
    </svg>
  );
}
