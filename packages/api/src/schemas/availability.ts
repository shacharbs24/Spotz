import { z } from "zod";

/** "HH:MM" 24-hour clock. Zero-padded so string comparison is chronological. */
export const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const availabilityDaySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, "שעה לא תקינה"),
    endTime: z.string().regex(timeRegex, "שעה לא תקינה"),
    isClosed: z.boolean(),
  })
  .refine((day) => day.isClosed || day.startTime < day.endTime, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["endTime"],
  });

export const updateAvailabilitySchema = z.object({
  days: z.array(availabilityDaySchema).min(1).max(7),
});

export type AvailabilityDay = z.infer<typeof availabilityDaySchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
