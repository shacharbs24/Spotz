export const MAX_SEND_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 60 * 60 * 1000;
export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeAppBaseUrl(value: string | undefined): string {
  const baseUrl = (value ?? "").trim().replace(/\/+$/, "");
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("APP_BASE_URL must be an absolute http(s) URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("APP_BASE_URL must be an absolute http(s) URL.");
  }

  return baseUrl;
}

export function getReminderWindowEnd(now: Date): Date {
  return new Date(now.getTime() + REMINDER_WINDOW_MS);
}

export function buildConfirmationUrl(
  appBaseUrl: string,
  appointmentId: string,
  confirmationToken: string,
): string {
  return `${appBaseUrl}/b/confirm/${encodeURIComponent(appointmentId)}?token=${encodeURIComponent(confirmationToken)}`;
}

export function isReminderRetryEligible(
  message: {
    status: string | null;
    attemptCount: number | null;
    nextAttemptAt: Date | null;
  },
  now: Date,
): boolean {
  return (
    message.status === "FAILED" &&
    (message.attemptCount ?? 1) < MAX_SEND_ATTEMPTS &&
    (!message.nextAttemptAt || message.nextAttemptAt <= now)
  );
}

export function getNextReminderRetryAt(
  now: Date,
  attemptCount: number,
): Date | null {
  if (attemptCount >= MAX_SEND_ATTEMPTS) return null;
  return new Date(now.getTime() + RETRY_DELAY_MS);
}
