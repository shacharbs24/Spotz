import { z } from "zod";

/**
 * Shared input schema for creating/updating a service. zod-only (no DB imports)
 * so the client form can reuse it. Price crosses the boundary as integer
 * `priceAgorot` (אגורות) to stay consistent with the `price_cents` column and
 * avoid floating-point money — the UI converts to/from shekels for display.
 */
export const serviceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "שם השירות חייב להכיל לפחות 2 תווים")
    .max(100, "שם השירות ארוך מדי"),
  description: z.string().trim().max(500, "התיאור ארוך מדי").optional(),
  durationMinutes: z.coerce
    .number()
    .int("משך בדקות שלמות בלבד")
    .min(5, "משך מינימלי 5 דקות")
    .max(600, "משך מקסימלי 600 דקות"),
  priceAgorot: z.coerce
    .number()
    .int()
    .min(0, "מחיר לא תקין")
    .max(100_000_000, "המחיר גבוה מדי"),
  // When true, bookings for this service await manual owner approval (PENDING);
  // otherwise they are auto-confirmed. Defaults to manual approval.
  requiresApproval: z.boolean().default(true),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;
