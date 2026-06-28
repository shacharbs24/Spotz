import { z } from "zod";

/**
 * Shared input schema for creating/updating a business. Lives in its own
 * dependency-light module (zod only, no DB imports) so the client form can
 * reuse it for React Hook Form validation without pulling server code into the
 * browser bundle.
 */
export const businessInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "שם העסק חייב להכיל לפחות 2 תווים")
    .max(120, "שם העסק ארוך מדי"),
  // Public URL segment: /b/[slug]. Lowercased, alphanumeric + single hyphens.
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "הכתובת חייבת להכיל לפחות 2 תווים")
    .max(60, "הכתובת ארוכה מדי")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "אותיות אנגליות קטנות, ספרות ומקפים בלבד (ללא רווחים)",
    ),
  timezone: z.string().min(1, "יש לבחור אזור זמן"),
  // Branding — optional. Empty input is allowed and normalized to null.
  description: z.string().trim().max(600, "התיאור ארוך מדי").optional(),
  // Image is a Base64 data URL (uploaded file) or an http(s) URL. Large cap to
  // fit a ~2MB image encoded as Base64.
  imageUrl: z
    .string()
    .trim()
    .max(3_000_000, "התמונה גדולה מדי")
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.startsWith("data:image/") || /^https?:\/\//.test(v),
      "פורמט תמונה לא נתמך",
    ),
  // Physical location — optional, free-text Hebrew. Empty input is allowed and
  // normalized to null in the mutation.
  city: z.string().trim().max(80, "שם העיר ארוך מדי").optional(),
  address: z.string().trim().max(200, "הכתובת ארוכה מדי").optional(),
  // --- Booking window ---
  autoOpenCalendar: z.boolean(),
  autoOpenDays: z.coerce
    .number()
    .int("מספר ימים שלם")
    .min(1, "לפחות יום אחד")
    .max(365, "עד 365 ימים"),
  manualOpenUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין")
    .optional()
    .or(z.literal("")),
}).refine(
  (d) => d.autoOpenCalendar || Boolean(d.manualOpenUntil),
  { message: "בחרו תאריך לסגירת היומן", path: ["manualOpenUntil"] },
);

export type BusinessInput = z.infer<typeof businessInputSchema>;
