"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createBlockedPeriodSchema,
  type CreateBlockedPeriodInput,
} from "@spotz/api/schemas/block";
import { trpc } from "@/trpc/client";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface BlockedPeriodFormProps {
  onClose: () => void;
}

export function BlockedPeriodForm({ onClose }: BlockedPeriodFormProps) {
  const utils = trpc.useUtils();

  const create = trpc.blocks.createBlockedPeriod.useMutation({
    onSuccess: () => {
      void utils.blocks.getBlockedPeriods.invalidate();
      onClose();
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateBlockedPeriodInput>({
    resolver: zodResolver(createBlockedPeriodSchema),
    defaultValues: {
      allDay: true,
      startDate: todayStr(),
      endDate: "",
      startTime: "",
      endTime: "",
      reason: "",
    },
  });

  const allDay = watch("allDay");

  return (
    <form
      onSubmit={handleSubmit((values) => create.mutate(values))}
      className="flex flex-col gap-5"
    >
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 cursor-pointer accent-[var(--color-owner)]"
          {...register("allDay")}
        />
        <span className="text-sm text-ink">יום/ימים שלמים</span>
      </label>

      {allDay ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="מתאריך" htmlFor="startDate" error={errors.startDate?.message}>
            <input
              id="startDate"
              type="date"
              dir="ltr"
              className={`${inputClass(Boolean(errors.startDate))} text-right`}
              {...register("startDate")}
            />
          </Field>
          <Field
            label="עד תאריך"
            htmlFor="endDate"
            error={errors.endDate?.message}
            hint="לחסימת יום בודד — השאירו ריק."
          >
            <input
              id="endDate"
              type="date"
              dir="ltr"
              className={`${inputClass(Boolean(errors.endDate))} text-right`}
              {...register("endDate")}
            />
          </Field>
        </div>
      ) : (
        <>
          <Field label="תאריך" htmlFor="startDate" error={errors.startDate?.message}>
            <input
              id="startDate"
              type="date"
              dir="ltr"
              className={`${inputClass(Boolean(errors.startDate))} text-right`}
              {...register("startDate")}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="משעה" htmlFor="startTime" error={errors.startTime?.message}>
              <input
                id="startTime"
                type="time"
                dir="ltr"
                className={`${inputClass(Boolean(errors.startTime))} text-right`}
                {...register("startTime")}
              />
            </Field>
            <Field label="עד שעה" htmlFor="endTime" error={errors.endTime?.message}>
              <input
                id="endTime"
                type="time"
                dir="ltr"
                className={`${inputClass(Boolean(errors.endTime))} text-right`}
                {...register("endTime")}
              />
            </Field>
          </div>
        </>
      )}

      <Field
        label="סיבה"
        htmlFor="reason"
        error={errors.reason?.message}
        hint="לא חובה — לדוגמה: חופשה, פגישה."
      >
        <input
          id="reason"
          type="text"
          placeholder="חופשה"
          className={inputClass(Boolean(errors.reason))}
          {...register("reason")}
        />
      </Field>

      {create.error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {create.error.message}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={create.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {create.isPending ? "שומר…" : "הוספת חסימה"}
        </button>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-owner ${
    hasError ? "border-danger" : "border-line"
  }`;
}
