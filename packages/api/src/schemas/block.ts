import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Input for creating a blocked period. `allDay` blocks one or more whole days
 * (startDate..endDate inclusive); otherwise a single date's start/end time.
 * The router converts these to absolute start/end timestamps in the business tz.
 */
export const createBlockedPeriodSchema = z
  .object({
    allDay: z.boolean(),
    startDate: z.string().regex(dateRegex, "תאריך לא תקין"),
    endDate: z
      .string()
      .regex(dateRegex, "תאריך לא תקין")
      .optional()
      .or(z.literal("")),
    startTime: z
      .string()
      .regex(timeRegex, "שעה לא תקינה")
      .optional()
      .or(z.literal("")),
    endTime: z
      .string()
      .regex(timeRegex, "שעה לא תקינה")
      .optional()
      .or(z.literal("")),
    reason: z.string().trim().max(120, "ההערה ארוכה מדי").optional(),
  })
  .superRefine((d, ctx) => {
    if (d.allDay) {
      if (d.endDate && d.endDate < d.startDate) {
        ctx.addIssue({
          path: ["endDate"],
          code: z.ZodIssueCode.custom,
          message: "תאריך הסיום לפני תאריך ההתחלה",
        });
      }
    } else {
      if (!d.startTime) {
        ctx.addIssue({
          path: ["startTime"],
          code: z.ZodIssueCode.custom,
          message: "יש לבחור שעת התחלה",
        });
      }
      if (!d.endTime) {
        ctx.addIssue({
          path: ["endTime"],
          code: z.ZodIssueCode.custom,
          message: "יש לבחור שעת סיום",
        });
      }
      if (d.startTime && d.endTime && d.endTime <= d.startTime) {
        ctx.addIssue({
          path: ["endTime"],
          code: z.ZodIssueCode.custom,
          message: "שעת הסיום חייבת להיות אחרי ההתחלה",
        });
      }
    }
  });

export type CreateBlockedPeriodInput = z.infer<typeof createBlockedPeriodSchema>;
