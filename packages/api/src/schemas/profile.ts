import { z } from "zod";

/**
 * Onboarding / profile details. Shared so the onboarding form can validate with
 * `zodResolver` and the `me.updateProfile` mutation can reuse it.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "יש להזין שם מלא").max(80, "שם ארוך מדי"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{9,15}$/, "מספר טלפון לא תקין"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
