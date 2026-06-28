"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  businessInputSchema,
  type BusinessInput,
} from "@spotz/api/schemas/business";
import { trpc } from "@/trpc/client";

/** Curated timezone options; Asia/Jerusalem is the product default. */
const TIMEZONES: readonly { value: string; label: string }[] = [
  { value: "Asia/Jerusalem", label: "ישראל (Asia/Jerusalem)" },
  { value: "Europe/London", label: "לונדון (Europe/London)" },
  { value: "Europe/Paris", label: "פריז (Europe/Paris)" },
  { value: "America/New_York", label: "ניו יורק (America/New_York)" },
];

const MAX_IMAGE_BYTES = 1_000_000; // ~1MB before Base64 inflation

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function BusinessForm() {
  const utils = trpc.useUtils();
  const businessQuery = trpc.businesses.getMyBusiness.useQuery();
  const existing = businessQuery.data;

  const upsert = trpc.businesses.upsertBusiness.useMutation({
    onSuccess: (saved) => {
      utils.businesses.getMyBusiness.setData(undefined, saved);
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<BusinessInput>({
    resolver: zodResolver(businessInputSchema),
    defaultValues: {
      name: "",
      slug: "",
      timezone: "Asia/Jerusalem",
      description: "",
      imageUrl: "",
      city: "",
      address: "",
      autoOpenCalendar: true,
      autoOpenDays: 14,
      manualOpenUntil: "",
    },
    // `values` keeps the form in sync once the query resolves (no effect needed).
    values: existing
      ? {
          name: existing.name,
          slug: existing.slug,
          timezone: existing.timezone,
          description: existing.description ?? "",
          imageUrl: existing.imageUrl ?? "",
          city: existing.city ?? "",
          address: existing.address ?? "",
          autoOpenCalendar: existing.autoOpenCalendar,
          autoOpenDays: existing.autoOpenDays,
          manualOpenUntil: existing.manualOpenUntil ?? "",
        }
      : undefined,
  });

  const slugPreview = (watch("slug") || "your-business").trim();
  const imageUrlPreview = watch("imageUrl")?.trim();
  const autoOpen = watch("autoOpenCalendar");

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("imageUrl", { message: "התמונה גדולה מדי (עד 1MB)" });
      return;
    }
    clearErrors("imageUrl");
    const dataUrl = await readAsDataUrl(file);
    setValue("imageUrl", dataUrl, { shouldDirty: true, shouldValidate: true });
  };

  if (businessQuery.isLoading) {
    return <FormSkeleton />;
  }

  return (
    <form
      onSubmit={handleSubmit((values) => upsert.mutate(values))}
      className="flex flex-col gap-6 rounded-2xl border border-line bg-surface-raised p-6 shadow-soft sm:p-8"
    >
      <Field
        label="שם העסק"
        htmlFor="name"
        error={errors.name?.message}
        hint="כך הלקוחות יזהו אתכם."
      >
        <input
          id="name"
          type="text"
          placeholder="לדוגמה: מספרת דנה"
          className={inputClass(Boolean(errors.name))}
          {...register("name")}
        />
      </Field>

      <Field
        label="כתובת ציבורית"
        htmlFor="slug"
        error={errors.slug?.message}
        hint={
          <span dir="ltr" className="font-mono text-xs text-ink-muted">
            spotz.app/b/{slugPreview}
          </span>
        }
      >
        <div className="flex items-stretch overflow-hidden rounded-xl border border-line focus-within:border-owner">
          <span
            dir="ltr"
            className="flex items-center bg-surface px-3 font-mono text-sm text-ink-muted"
          >
            /b/
          </span>
          <input
            id="slug"
            type="text"
            dir="ltr"
            placeholder="dana-salon"
            className="w-full bg-surface-raised px-3 py-2.5 font-mono text-sm text-ink outline-none placeholder:text-ink-muted/60"
            {...register("slug")}
          />
        </div>
      </Field>

      <Field
        label="תיאור העסק"
        htmlFor="description"
        error={errors.description?.message}
        hint="יוצג בדף ההזמנות הציבורי. לא חובה."
      >
        <textarea
          id="description"
          rows={4}
          placeholder="ספרו ללקוחות על העסק שלכם…"
          className={`${inputClass(Boolean(errors.description))} resize-none`}
          {...register("description")}
        />
      </Field>

      <Field
        label="תמונה / לוגו"
        htmlFor="imageFile"
        error={errors.imageUrl?.message}
        hint="העלו קובץ תמונה מהמחשב (עד 1MB). לא חובה."
      >
        {imageUrlPreview ? (
          <div className="mb-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrlPreview}
              alt="תצוגה מקדימה"
              className="h-20 w-20 rounded-xl border border-line object-cover"
            />
            <button
              type="button"
              onClick={() => setValue("imageUrl", "", { shouldDirty: true })}
              className="cursor-pointer text-sm font-medium text-client hover:underline"
            >
              הסרת תמונה
            </button>
          </div>
        ) : null}
        <input
          id="imageFile"
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:ml-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-owner-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-owner"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="עיר"
          htmlFor="city"
          error={errors.city?.message}
          hint="לא חובה"
        >
          <input
            id="city"
            type="text"
            placeholder="לדוגמה: תל אביב"
            className={inputClass(Boolean(errors.city))}
            {...register("city")}
          />
        </Field>

        <Field
          label="כתובת"
          htmlFor="address"
          error={errors.address?.message}
          hint="לא חובה"
        >
          <input
            id="address"
            type="text"
            placeholder="לדוגמה: רחוב דיזנגוף 50"
            className={inputClass(Boolean(errors.address))}
            {...register("address")}
          />
        </Field>
      </div>

      <Field label="אזור זמן" htmlFor="timezone" error={errors.timezone?.message}>
        <select
          id="timezone"
          className={inputClass(Boolean(errors.timezone))}
          {...register("timezone")}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Booking window */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <span className="text-sm font-medium text-ink">יומן הזמנות</span>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5 cursor-pointer accent-[var(--color-owner)]"
            {...register("autoOpenCalendar")}
          />
          <span className="text-sm text-ink">פתיחת יומן אוטומטית</span>
        </label>

        {autoOpen ? (
          <Field
            label="כמה ימים קדימה לפתוח"
            htmlFor="autoOpenDays"
            error={errors.autoOpenDays?.message}
            hint="היומן מתגלגל קדימה — לקוחות יכולים לקבוע עד היום + מספר זה."
          >
            <input
              id="autoOpenDays"
              type="number"
              min={1}
              max={365}
              dir="ltr"
              className={`${inputClass(Boolean(errors.autoOpenDays))} text-right`}
              {...register("autoOpenDays")}
            />
          </Field>
        ) : (
          <Field
            label="פתוח להזמנות עד תאריך"
            htmlFor="manualOpenUntil"
            error={errors.manualOpenUntil?.message}
            hint="לא ניתן יהיה לקבוע תור אחרי תאריך זה."
          >
            <input
              id="manualOpenUntil"
              type="date"
              dir="ltr"
              className={`${inputClass(Boolean(errors.manualOpenUntil))} text-right`}
              {...register("manualOpenUntil")}
            />
          </Field>
        )}
      </div>

      {upsert.error && (
        <p
          role="alert"
          className="rounded-xl bg-client-soft px-4 py-3 text-sm text-client"
        >
          {upsert.error.message}
        </p>
      )}

      {upsert.isSuccess && !isDirty && (
        <p
          role="status"
          className="rounded-xl bg-owner-soft px-4 py-3 text-sm text-owner"
        >
          ✓ הפרטים נשמרו בהצלחה.
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={upsert.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {upsert.isPending
            ? "שומר…"
            : existing
              ? "שמירת שינויים"
              : "יצירת העסק"}
        </button>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
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

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-line bg-surface-raised p-6 shadow-soft sm:p-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-line" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-line" />
        </div>
      ))}
    </div>
  );
}
