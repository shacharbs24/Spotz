"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { formatPrice } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { ReviewForm } from "./ReviewForm";
import type { ClientAppointment, MyBusiness } from "@/trpc/types";
import type { AppointmentStatus } from "@spotz/api/schemas/appointment";

const STATUS_META: Record<AppointmentStatus, { label: string; badge: string }> =
  {
    PENDING: { label: "ממתין", badge: "bg-pending-soft text-pending" },
    CONFIRMED: { label: "מאושר", badge: "bg-success-soft text-success" },
    CANCELLED: { label: "מבוטל", badge: "bg-danger-soft text-danger" },
    COMPLETED: { label: "הושלם", badge: "bg-owner-soft text-owner" },
  };

export function ClientPortal({ name }: { name: string | null }) {
  const utils = trpc.useUtils();
  const upcomingQuery = trpc.me.getMyAppointments.useQuery();
  const pastQuery = trpc.me.getMyPastAppointments.useInfiniteQuery(
    {},
    { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
  );
  const businessesQuery = trpc.me.getMyBusinesses.useQuery();

  const cancel = trpc.me.cancelMyAppointment.useMutation({
    onSuccess: () => utils.me.getMyAppointments.invalidate(),
  });

  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const upcoming = upcomingQuery.data?.upcoming ?? [];
  const past = pastQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const businesses = businessesQuery.data ?? [];

  return (
    <div className="flex w-full flex-col gap-8 text-right">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          שלום{name ? `, ${name}` : ""} 👋
        </h1>
        <p className="text-ink-muted">כאן תוכלו לעקוב אחר התורים שלכם.</p>
      </div>

      {businesses.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            העסקים שלי
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <MyBusinessCard key={business.id} business={business} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          התורים הבאים
        </h2>
        {upcomingQuery.isLoading ? (
          <ListSkeleton />
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-10 text-center text-ink-muted">
            אין לכם תורים קרובים.
          </div>
        ) : (
          upcoming.map((appointment) => (
            <ClientApptCard
              key={appointment.id}
              appointment={appointment}
              cancellable={
                appointment.status === "PENDING" ||
                appointment.status === "CONFIRMED"
              }
              onCancel={() => cancel.mutate({ id: appointment.id })}
              isCancelling={
                cancel.isPending && cancel.variables?.id === appointment.id
              }
            />
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            היסטוריית תורים
          </h2>
          {past.map((appointment) => (
            <ClientApptCard
              key={appointment.id}
              appointment={appointment}
              reviewable={
                appointment.status === "COMPLETED" && !appointment.hasReview
              }
              onReview={() => setReviewingId(appointment.id)}
            />
          ))}
          {pastQuery.hasNextPage && (
            <button
              type="button"
              onClick={() => pastQuery.fetchNextPage()}
              disabled={pastQuery.isFetchingNextPage}
              className="mx-auto mt-1 cursor-pointer rounded-full border border-line px-5 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-owner/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pastQuery.isFetchingNextPage ? "טוען…" : "טען היסטוריה נוספת"}
            </button>
          )}
        </section>
      )}

      <Modal
        open={reviewingId !== null}
        onClose={() => setReviewingId(null)}
        title="הוספת חוות דעת"
      >
        {reviewingId && (
          <ReviewForm
            appointmentId={reviewingId}
            onClose={() => setReviewingId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function MyBusinessCard({ business }: { business: MyBusiness }) {
  return (
    <Link
      href={`/b/${business.slug}`}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-surface-raised p-3 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-owner/40"
    >
      {business.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={business.imageUrl}
          alt={business.name}
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-owner-soft text-lg font-bold text-owner">
          {business.name.charAt(0)}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold tracking-tight text-ink">
          {business.name}
        </span>
        <span className="inline-flex items-center gap-1 text-sm text-owner">
          קביעת תור
          <span className="transition-transform duration-300 group-hover:-translate-x-1">
            ←
          </span>
        </span>
      </span>
    </Link>
  );
}

interface ClientApptCardProps {
  appointment: ClientAppointment;
  cancellable?: boolean;
  onCancel?: () => void;
  isCancelling?: boolean;
  reviewable?: boolean;
  onReview?: () => void;
}

function ClientApptCard({
  appointment,
  cancellable = false,
  onCancel,
  isCancelling = false,
  reviewable = false,
  onReview,
}: ClientApptCardProps) {
  const [confirming, setConfirming] = useState(false);
  const meta = STATUS_META[appointment.status];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight text-ink">
            {appointment.businessName}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
          >
            {meta.label}
          </span>
        </div>
        <span className="text-sm text-ink-muted">{appointment.serviceName}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span>{appointment.date}</span>
          <span dir="ltr">
            {appointment.startTime}–{appointment.endTime}
          </span>
          <span className="font-medium text-owner">
            {formatPrice(appointment.priceCentsSnapshot)}
          </span>
        </div>
      </div>

      {reviewable && onReview && (
        <button
          type="button"
          onClick={onReview}
          className="cursor-pointer rounded-full bg-owner px-4 py-1.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
        >
          הוסף חוות דעת
        </button>
      )}

      {cancellable && appointment.isWithin24h && (
        <p className="max-w-xs text-xs leading-5 text-ink-muted sm:text-sm">
          לא ניתן לבטל תור פחות מ-24 שעות מראש. יש ליצור קשר עם בית העסק
          {appointment.businessPhone ? (
            <>
              {" "}
              בטלפון:{" "}
              <a
                href={`tel:${appointment.businessPhone}`}
                dir="ltr"
                className="font-medium text-owner hover:underline"
              >
                {appointment.businessPhone}
              </a>
            </>
          ) : (
            "."
          )}
        </p>
      )}

      {cancellable &&
        !appointment.isWithin24h &&
        onCancel &&
        (confirming ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <span className="text-ink-muted">לבטל?</span>
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="cursor-pointer font-medium text-danger transition-colors hover:underline disabled:opacity-60"
            >
              {isCancelling ? "מבטל…" : "כן, בטל"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="cursor-pointer text-ink-muted transition-colors hover:text-ink"
            >
              חזרה
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
          >
            ביטול תור
          </button>
        ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-line" />
          <div className="h-4 w-56 animate-pulse rounded bg-line" />
        </div>
      ))}
    </div>
  );
}
