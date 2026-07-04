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
}

export function OnboardingForm({
  defaultName,
  defaultPhone,
  redirectTo,
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
      className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-6 shadow-soft sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium text-ink">
          שם מלא
        </label>
        <input
          id="fullName"
          type="text"
          placeholder="ישראל ישראלי"
          className={inputClass(Boolean(errors.fullName))}
          {...register("fullName")}
        />
        {errors.fullName ? (
          <p className="text-xs text-danger">{errors.fullName.message}</p>
        ) : (
          <p className="text-xs text-ink-muted">מומלץ להזין את השם בעברית</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium text-ink">
          טלפון
        </label>
        <input
          id="phone"
          type="tel"
          dir="ltr"
          placeholder="050-0000000"
          className={`${inputClass(Boolean(errors.phone))} text-right`}
          {...register("phone")}
        />
        {errors.phone && (
          <p className="text-xs text-danger">{errors.phone.message}</p>
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
        className="inline-flex items-center justify-center gap-2 rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {update.isPending ? "שומר…" : "שמירה והמשך"}
      </button>
    </form>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-owner ${
    hasError ? "border-danger" : "border-line"
  }`;
}
