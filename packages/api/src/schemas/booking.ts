import { z } from "zod";

/**
 * Input for creating an appointment. Bookings require an authenticated +
 * onboarded user, so the client's name/phone come from their profile (not the
 * request) — only the slot selection is sent.
 */
export const createAppointmentSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "שעה לא תקינה"),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
