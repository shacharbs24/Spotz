/** Formats integer agorot as a localized currency string (e.g. 8000 → ‏₪80.00). */
export function formatPrice(priceCents: number, currency = "ILS"): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

/** Formats a minute count as a short Hebrew duration (e.g. 90 → "1 שע׳ 30 דק׳"). */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours} שע׳` : `${hours} שע׳ ${mins} דק׳`;
}
