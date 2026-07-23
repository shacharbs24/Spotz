import { z } from "zod";
import { normalizeIsraeliPhone } from "../lib/phone";

/**
 * Onboarding / profile details. Shared so the onboarding form can validate with
 * `zodResolver` and the `me.updateProfile` mutation can reuse it.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "יש להזין שם מלא").max(80, "שם ארוך מדי"),
  // Normalize to E.164-without-plus on the way in and reject anything we can't
  // normalize, so every stored phone is dial-ready and safe as a dedup key.
  // The output type is a (normalized) string.
  phone: z
    .string()
    .trim()
    .transform((value) => normalizeIsraeliPhone(value))
    .refine((value): value is string => value !== null, {
      message: "מספר טלפון לא תקין",
    }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
