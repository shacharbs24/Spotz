"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/trpc/client";
import { Modal } from "@/components/ui/Modal";

// Name is required in the form (router also accepts a signed-in user's name,
// but the UI always asks so guests work too).
const formSchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(1, "יש לבחור דירוג בין 1 ל-5")
    .max(5, "יש לבחור דירוג בין 1 ל-5"),
  reviewerName: z.string().trim().min(2, "יש להזין שם").max(80, "השם ארוך מדי"),
  comment: z.string().trim().max(1000, "התגובה ארוכה מדי").optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface PublicReviewButtonProps {
  businessId: string;
  defaultName: string;
}

export function PublicReviewButton({
  businessId,
  defaultName,
}: PublicReviewButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:border-owner/40 hover:text-ink"
      >
        הוסף חוות דעת
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="הוספת חוות דעת">
        <ReviewFields
          businessId={businessId}
          defaultName={defaultName}
          onDone={() => {
            setOpen(false);
            router.refresh(); // re-fetch the server-rendered summary + list
          }}
        />
      </Modal>
    </>
  );
}

function ReviewFields({
  businessId,
  defaultName,
  onDone,
}: {
  businessId: string;
  defaultName: string;
  onDone: () => void;
}) {
  const [hovered, setHovered] = useState(0);

  const create = trpc.reviews.createBusinessReview.useMutation({
    onSuccess: onDone,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { rating: 0, reviewerName: defaultName, comment: "" },
  });

  const rating = watch("rating");

  return (
    <form
      onSubmit={handleSubmit((values) => create.mutate({ businessId, ...values }))}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">דירוג</label>
        <div dir="ltr" className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const active = star <= (hovered || rating);
            return (
              <button
                key={star}
                type="button"
                aria-label={`${star} כוכבים`}
                onClick={() =>
                  setValue("rating", star, { shouldValidate: true })
                }
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="cursor-pointer p-0.5"
              >
                <svg
                  width={30}
                  height={30}
                  viewBox="0 0 24 24"
                  fill={active ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  className={`transition-colors ${active ? "text-pending" : "text-line"}`}
                  aria-hidden="true"
                >
                  <path d="M12 2.6l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 18.66l-5.9 3.11 1.13-6.57L2.45 9.54l6.6-.96L12 2.6z" />
                </svg>
              </button>
            );
          })}
        </div>
        {errors.rating && (
          <p className="text-xs text-danger">{errors.rating.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reviewerName" className="text-sm font-medium text-ink">
          שם
        </label>
        <input
          id="reviewerName"
          type="text"
          placeholder="השם שיוצג"
          className={`w-full rounded-xl border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-owner ${
            errors.reviewerName ? "border-danger" : "border-line"
          }`}
          {...register("reviewerName")}
        />
        {errors.reviewerName && (
          <p className="text-xs text-danger">{errors.reviewerName.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="comment" className="text-sm font-medium text-ink">
          תגובה <span className="text-ink-muted">(לא חובה)</span>
        </label>
        <textarea
          id="comment"
          rows={4}
          placeholder="ספרו על החוויה שלכם…"
          className={`w-full resize-none rounded-xl border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-owner ${
            errors.comment ? "border-danger" : "border-line"
          }`}
          {...register("comment")}
        />
        {errors.comment && (
          <p className="text-xs text-danger">{errors.comment.message}</p>
        )}
      </div>

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
          type="submit"
          disabled={create.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {create.isPending ? "שולח…" : "שליחת חוות דעת"}
        </button>
      </div>
    </form>
  );
}
