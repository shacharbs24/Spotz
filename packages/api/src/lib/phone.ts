/**
 * Normalizes an Israeli phone number to WhatsApp's E.164-without-plus form,
 * e.g. "050-123-4567" / "0501234567" / "+972501234567" → "972501234567".
 *
 * Returns `null` when the input can't be normalized to a valid IL number
 * (caller marks the reminder SKIPPED).
 */
export function normalizeIsraeliPhone(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;

  // Drop international "00" prefix if present (e.g. 00972…).
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("972")) {
    // already country-coded
  } else if (digits.startsWith("0")) {
    // national format with trunk 0 → swap for country code
    digits = "972" + digits.slice(1);
  } else {
    // local significant number without trunk 0 (e.g. 50…)
    digits = "972" + digits;
  }

  // IL country code (972) + 8 (landline) or 9 (mobile) significant digits.
  if (!/^972\d{8,9}$/.test(digits)) return null;
  return digits;
}
