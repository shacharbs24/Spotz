"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  serviceInputSchema,
  type ServiceInput,
} from "@spotz/api/schemas/service";
import { trpc } from "@/trpc/client";
import type { ServiceRow } from "@/trpc/types";

/**
 * Form values mirror the shared schema but collect price in shekels for a
 * friendlier UI; we convert to integer agorot on submit.
 */
const serviceFormSchema = serviceInputSchema
  // Price is collected in shekels for a friendlier UI; converted on submit.
  .omit({ priceAgorot: true })
  .extend({
    priceShekels: z.coerce
      .number()
      .min(0, "מחיר לא תקין")
      .max(1_000_000, "המחיר גבוה מדי"),
  });
type ServiceFormValues = z.infer<typeof serviceFormSchema>;

interface ServiceFormProps {
  service: ServiceRow | null;
  onClose: () => void;
}

export function ServiceForm({ service, onClose }: ServiceFormProps) {
  const utils = trpc.useUtils();
  const isEditing = Boolean(service);

  const onSuccess = () => {
    void utils.services.getServices.invalidate();
    onClose();
  };

  const create = trpc.services.createService.useMutation({ onSuccess });
  const update = trpc.services.updateService.useMutation({ onSuccess });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: service
      ? {
          name: service.name,
          description: service.description ?? "",
          durationMinutes: service.durationMinutes,
          priceShekels: service.priceCents / 100,
          requiresApproval: service.requiresApproval,
        }
      : {
          name: "",
          description: "",
          durationMinutes: 30,
          priceShekels: 0,
          requiresApproval: true,
        },
  });

  const isPending = create.isPending || update.isPending;
  const mutationError = create.error ?? update.error;

  const onSubmit = (values: ServiceFormValues) => {
    const payload: ServiceInput = {
      name: values.name,
      description: values.description,
      durationMinutes: values.durationMinutes,
      priceAgorot: Math.round(values.priceShekels * 100),
      requiresApproval: values.requiresApproval,
    };
    if (service) {
      update.mutate({ ...payload, id: service.id });
    } else {
      create.mutate(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Field label="שם השירות" htmlFor="name" error={errors.name?.message}>
        <input
          id="name"
          type="text"
          placeholder="לדוגמה: תספורת גברים"
          className={inputClass(Boolean(errors.name))}
          {...register("name")}
        />
      </Field>

      <Field
        label="תיאור"
        htmlFor="description"
        error={errors.description?.message}
        hint="לא חובה"
      >
        <textarea
          id="description"
          rows={3}
          placeholder="פרטים נוספים על השירות…"
          className={`${inputClass(Boolean(errors.description))} resize-none`}
          {...register("description")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="משך (דקות)"
          htmlFor="durationMinutes"
          error={errors.durationMinutes?.message}
        >
          <input
            id="durationMinutes"
            type="number"
            min={5}
            max={600}
            step={5}
            dir="ltr"
            className={`${inputClass(Boolean(errors.durationMinutes))} text-right`}
            {...register("durationMinutes")}
          />
        </Field>

        <Field
          label="מחיר (₪)"
          htmlFor="priceShekels"
          error={errors.priceShekels?.message}
        >
          <input
            id="priceShekels"
            type="number"
            min={0}
            step="0.01"
            dir="ltr"
            className={`${inputClass(Boolean(errors.priceShekels))} text-right`}
            {...register("priceShekels")}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3 transition-colors hover:border-owner/40">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-owner"
          {...register("requiresApproval")}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink">
            אישור ידני על ידי בעל העסק
          </span>
          <span className="text-xs leading-5 text-ink-muted">
            כשמסומן, תורים לשירות זה יישארו בסטטוס &quot;ממתין&quot; עד לאישורכם.
            אחרת הם יאושרו אוטומטית.
          </span>
        </span>
      </label>

      {mutationError && (
        <p
          role="alert"
          className="rounded-xl bg-client-soft px-4 py-3 text-sm text-client"
        >
          {mutationError.message}
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
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "שומר…" : isEditing ? "שמירת שינויים" : "הוספת שירות"}
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
        <p className="text-xs text-client">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-owner ${
    hasError ? "border-client" : "border-line"
  }`;
}
