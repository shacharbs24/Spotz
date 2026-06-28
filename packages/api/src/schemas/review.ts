import { z } from "zod";

/**
 * Shared input schema for creating a review. zod-only (no DB imports) so the
 * client form can reuse it via `zodResolver`. The appointment binds the review
 * to a business + client server-side; the client only supplies rating + comment.
 */
export const createReviewSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.coerce
    .number()
    .int("דירוג חייב להיות מספר שלם")
    .min(1, "יש לבחור דירוג בין 1 ל-5")
    .max(5, "יש לבחור דירוג בין 1 ל-5"),
  comment: z.string().trim().max(1000, "התגובה ארוכה מדי").optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/**
 * Direct public review (no appointment required). `reviewerName` is optional at
 * the schema level — the router falls back to a signed-in user's name, and
 * requires a name for guests.
 */
export const createBusinessReviewSchema = z.object({
  businessId: z.string().uuid(),
  rating: z.coerce
    .number()
    .int("דירוג חייב להיות מספר שלם")
    .min(1, "יש לבחור דירוג בין 1 ל-5")
    .max(5, "יש לבחור דירוג בין 1 ל-5"),
  comment: z.string().trim().max(1000, "התגובה ארוכה מדי").optional(),
  reviewerName: z
    .string()
    .trim()
    .min(2, "יש להזין שם")
    .max(80, "השם ארוך מדי")
    .optional(),
});

export type CreateBusinessReviewInput = z.infer<
  typeof createBusinessReviewSchema
>;

/** Owner-only visibility toggle. */
export const updateReviewVisibilitySchema = z.object({
  reviewId: z.string().uuid(),
  isVisible: z.boolean(),
});

export type UpdateReviewVisibilityInput = z.infer<
  typeof updateReviewVisibilitySchema
>;
