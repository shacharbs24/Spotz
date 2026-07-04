import { z } from "zod";

/** "HH:MM" 24-hour clock. Zero-padded so string comparison is chronological. */
export const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A single intra-day break ("HH:MM"–"HH:MM"), end strictly after start. */
export const availabilityBreakSchema = z
  .object({
    start: z.string().regex(timeRegex, "שעה לא תקינה"),
    end: z.string().regex(timeRegex, "שעה לא תקינה"),
  })
  .refine((brk) => brk.start < brk.end, {
    message: "שעת סיום ההפסקה חייבת להיות אחרי שעת ההתחלה",
    path: ["end"],
  });

export const availabilityDaySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, "שעה לא תקינה"),
    endTime: z.string().regex(timeRegex, "שעה לא תקינה"),
    isClosed: z.boolean(),
    breaks: z.array(availabilityBreakSchema).max(10).default([]),
  })
  .refine((day) => day.isClosed || day.startTime < day.endTime, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["endTime"],
  })
  .refine(
    (day) =>
      day.isClosed ||
      day.breaks.every(
        (brk) => brk.start >= day.startTime && brk.end <= day.endTime,
      ),
    {
      message: "ההפסקה חייבת להיות בתוך שעות הפעילות",
      path: ["breaks"],
    },
  );

export const updateAvailabilitySchema = z.object({
  days: z.array(availabilityDaySchema).min(1).max(7),
});

export type AvailabilityBreak = z.infer<typeof availabilityBreakSchema>;
export type AvailabilityDay = z.infer<typeof availabilityDaySchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
