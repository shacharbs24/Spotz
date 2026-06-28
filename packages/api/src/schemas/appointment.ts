import { z } from "zod";

/** Mirrors the `appointment_status` pg enum. */
export const appointmentStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
]);

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const updateAppointmentStatusSchema = z.object({
  id: z.string().uuid(),
  status: appointmentStatusSchema,
});
