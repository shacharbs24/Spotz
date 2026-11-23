"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@spotz/api/schemas/profile";
import { trpc } from "@/trpc/client";

interface OnboardingFormProps {
  defaultName: string;
  defaultPhone: string;
  redirectTo: string;
  returningToBooking: boolean;
}

export function OnboardingForm({
  defaultName,
  defaultPhone,
  redirectTo,
  returningToBooking,
}: OnboardingFormProps) {
  const router = useRouter();

  const update = trpc.me.updateProfile.useMutation({
    onSuccess: () => {
      router.push(redirectTo);
      router.refresh();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { fullName: defaultName, phone: defaultPhone },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => update.mutate(values))}
      className="flex flex-col gap-5 rounded-xl border border-line bg-surface-raised p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium text-ink">
          שם מלא
        </label>
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby="fullName-description"
          placeholder="ישראל ישראלי"
          className={inputClass(Boolean(errors.fullName))}
          {...register("fullName")}
        />
        <p
          id="fullName-description"
          className={
            errors.fullName ? "text-sm text-danger" : "text-sm text-ink-muted"
          }
        >
          {errors.fullName?.message ?? "מומלץ להזין את השם בעברית"}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium text-ink">
          טלפון
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          dir="ltr"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          placeholder="050-0000000"
          className={`${inputClass(Boolean(errors.phone))} text-right`}
          {...register("phone")}
        />
        {errors.phone && (
          <p id="phone-error" className="text-sm text-danger">
            {errors.phone.message}
          </p>
        )}
      </div>

      {update.error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {update.error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={update.isPending}
        className="action-primary"
      >
        {update.isPending
          ? "שומר…"
          : returningToBooking
            ? "שמירה וחזרה להזמנה"
            : "שמירה והמשך"}
      </button>
    </form>
  );
}

function inputClass(hasError: boolean): string {
  return `min-h-11 w-full rounded-lg border bg-surface-raised px-3 py-2 text-base text-ink transition-colors placeholder:text-ink-muted focus:border-owner ${
    hasError ? "border-danger" : "border-control"
  }`;
}
