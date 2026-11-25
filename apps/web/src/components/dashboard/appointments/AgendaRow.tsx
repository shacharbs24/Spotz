"use client";

import { formatPrice } from "@/lib/format";
import type { AppointmentRow } from "@/trpc/types";
import type { AppointmentStatus } from "@spotz/api/schemas/appointment";

export const STATUS_META: Record<
  AppointmentStatus,
  { label: string; badge: string }
> = {
  PENDING: { label: "ממתין", badge: "bg-pending-soft text-pending" },
  CONFIRMED: { label: "מאושר", badge: "bg-success-soft text-success" },
  CANCELLED: { label: "מבוטל", badge: "bg-danger-soft text-danger" },
  COMPLETED: { label: "הושלם", badge: "bg-owner-soft text-owner" },
};

type ActionVariant = "primary" | "danger";

// Terminal states (COMPLETED, CANCELLED) expose no actions — in particular a
// completed appointment never offers "ביטול" (cancel).
const NEXT_ACTIONS: Record<
  AppointmentStatus,
  { label: string; status: AppointmentStatus; variant: ActionVariant }[]
> = {
  PENDING: [
    { label: "אישור", status: "CONFIRMED", variant: "primary" },
    { label: "ביטול", status: "CANCELLED", variant: "danger" },
  ],
  CONFIRMED: [
    { label: "הושלם", status: "COMPLETED", variant: "primary" },
    { label: "ביטול", status: "CANCELLED", variant: "danger" },
  ],
  CANCELLED: [],
  COMPLETED: [],
};

/** Local `YYYY-MM-DD` for the given date — the input shape the API expects. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface AgendaRowProps {
  appointment: AppointmentRow;
  onChangeStatus: (status: AppointmentStatus) => void;
  isUpdating: boolean;
  updateError?: string;
}

export function AgendaRow({
  appointment,
  onChangeStatus,
  isUpdating,
  updateError,
}: AgendaRowProps) {
  const meta = STATUS_META[appointment.status];
  const actions = NEXT_ACTIONS[appointment.status];

  return (
    <li
      id={`appointment-${appointment.id}`}
      tabIndex={-1}
      className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-3 py-4 first:rounded-t-xl last:rounded-b-xl target:bg-owner-soft/45 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-4"
    >
      <div className="flex flex-col items-start text-sm tabular-nums">
        <time
          dateTime={appointment.startTime}
          dir="ltr"
          className="font-semibold text-ink"
        >
          {appointment.startTime}
        </time>
        <time
          dateTime={appointment.endTime}
          dir="ltr"
          className="text-xs text-ink-muted"
        >
          {appointment.endTime}
        </time>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words font-semibold text-ink">
            {appointment.serviceName}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
          >
            {meta.label}
          </span>
          {appointment.arrivalConfirmed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
              אישור הגעה התקבל
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <bdi className="break-words text-ink">{appointment.clientName}</bdi>
          <a
            href={`tel:${appointment.clientPhone}`}
            dir="ltr"
            className="text-ink-muted transition-colors hover:text-ink"
          >
            {appointment.clientPhone}
          </a>
          <bdi className="font-medium whitespace-nowrap text-ink-muted tabular-nums">
            {formatPrice(appointment.priceCentsSnapshot)}
          </bdi>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:justify-end">
          {actions.map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={isUpdating}
              onClick={() => onChangeStatus(action.status)}
              className={actionClass(action.variant)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {isUpdating && (
        <p role="status" className="col-start-2 text-sm text-ink-muted">
          מעדכנים את התור…
        </p>
      )}
      {updateError && (
        <p role="alert" className="col-start-2 text-sm text-danger">
          {updateError}
        </p>
      )}
    </li>
  );
}

function actionClass(variant: ActionVariant): string {
  if (variant === "primary") {
    return "action-primary";
  }
  return "min-h-11 cursor-pointer rounded-lg px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60";
}

export function AgendaSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="divide-y divide-line rounded-xl border border-line bg-surface-raised"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 px-3 py-4 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:px-4"
        >
          <div className="pt-1">
            <div className="h-4 w-10 animate-pulse rounded bg-line" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 max-w-full animate-pulse rounded bg-line" />
            <div className="h-4 w-56 max-w-full animate-pulse rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
