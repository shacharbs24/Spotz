"use client";

import Link from "next/link";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { timeRegex } from "@spotz/api/schemas/availability";
import { trpc } from "@/trpc/client";

const DAY_NAMES = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
] as const;

/** Form values use `isOpen` (friendlier); converted to `isClosed` on submit. */
const dayFormSchema = z
  .object({
    dayOfWeek: z.number(),
    isOpen: z.boolean(),
    startTime: z.string().regex(timeRegex, "שעה לא תקינה"),
    endTime: z.string().regex(timeRegex, "שעה לא תקינה"),
  })
  .refine((day) => !day.isOpen || day.startTime < day.endTime, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה",
    path: ["endTime"],
  });
const availabilityFormSchema = z.object({ days: z.array(dayFormSchema) });
type AvailabilityFormValues = z.infer<typeof availabilityFormSchema>;

const FALLBACK_DAYS = Array.from({ length: 7 }, (_unused, i) => ({
  dayOfWeek: i,
  isOpen: i < 5,
  startTime: "09:00",
  endTime: "18:00",
}));

export function AvailabilityForm() {
  const utils = trpc.useUtils();
  const businessQuery = trpc.businesses.getMyBusiness.useQuery();
  const availabilityQuery = trpc.availability.getOurAvailability.useQuery();

  const update = trpc.availability.updateAvailability.useMutation({
    onSuccess: () => utils.availability.getOurAvailability.invalidate(),
  });

  const data = availabilityQuery.data;
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: { days: FALLBACK_DAYS },
    values: data
      ? {
          days: data.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            isOpen: !day.isClosed,
            startTime: day.startTime,
            endTime: day.endTime,
          })),
        }
      : undefined,
  });
  const { fields } = useFieldArray({ control, name: "days" });

  if (businessQuery.isLoading || availabilityQuery.isLoading) {
    return <FormSkeleton />;
  }

  if (businessQuery.data === null) {
    return <NoBusinessNotice />;
  }

  const watchedDays = watch("days");

  const onSubmit = (values: AvailabilityFormValues) => {
    update.mutate({
      days: values.days.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
        isClosed: !day.isOpen,
      })),
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6 rounded-2xl border border-line bg-surface-raised p-2 shadow-soft sm:p-4"
    >
      <ul className="flex flex-col divide-y divide-line">
        {fields.map((field, index) => {
          const isOpen = watchedDays?.[index]?.isOpen ?? true;
          const endError = errors.days?.[index]?.endTime?.message;

          return (
            <li
              key={field.id}
              className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:gap-6"
            >
              <input
                type="hidden"
                {...register(`days.${index}.dayOfWeek`, { valueAsNumber: true })}
              />

              <label className="flex cursor-pointer items-center gap-3 sm:w-40">
                <input
                  type="checkbox"
                  {...register(`days.${index}.isOpen`)}
                  className="h-5 w-5 cursor-pointer accent-[var(--color-owner)]"
                />
                <span className="font-medium text-ink">
                  {DAY_NAMES[field.dayOfWeek]}
                </span>
              </label>

              {isOpen ? (
                <div className="flex flex-wrap items-center gap-2 sm:mr-auto">
                  <input
                    type="time"
                    dir="ltr"
                    {...register(`days.${index}.startTime`)}
                    className={timeInputClass}
                  />
                  <span className="text-sm text-ink-muted">עד</span>
                  <input
                    type="time"
                    dir="ltr"
                    {...register(`days.${index}.endTime`)}
                    className={timeInputClass}
                  />
                  {endError && (
                    <span className="w-full text-xs text-client sm:w-auto">
                      {endError}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-ink-muted sm:mr-auto">סגור</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 px-3 pb-2">
        {update.error && (
          <p
            role="alert"
            className="rounded-xl bg-client-soft px-4 py-3 text-sm text-client"
          >
            {update.error.message}
          </p>
        )}
        {update.isSuccess && (
          <p
            role="status"
            className="rounded-xl bg-owner-soft px-4 py-3 text-sm text-owner"
          >
            ✓ שעות הפעילות נשמרו.
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={update.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {update.isPending ? "שומר…" : "שמירת שעות הפעילות"}
          </button>
        </div>
      </div>
    </form>
  );
}

const timeInputClass =
  "rounded-xl border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-owner";

function NoBusinessNotice() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-14 text-center">
      <p className="text-ink">עדיין לא הגדרתם את פרטי העסק.</p>
      <p className="max-w-sm text-sm text-ink-muted">
        כדי להגדיר שעות פעילות, צרו תחילה את פרטי העסק שלכם.
      </p>
      <Link
        href="/dashboard/business"
        className="cursor-pointer rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
      >
        להגדרת פרטי העסק
      </Link>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface-raised p-4 shadow-soft">
      {Array.from({ length: 7 }, (_unused, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-4">
          <div className="h-5 w-32 animate-pulse rounded bg-line" />
          <div className="h-9 w-40 animate-pulse rounded-xl bg-line" />
        </div>
      ))}
    </div>
  );
}
