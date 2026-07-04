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
}

export function AgendaRow({
  appointment,
  onChangeStatus,
  isUpdating,
}: AgendaRowProps) {
  const meta = STATUS_META[appointment.status];
  const actions = NEXT_ACTIONS[appointment.status];

  return (
    <li className="flex gap-4">
      <div className="flex w-14 shrink-0 flex-col items-center pt-3 text-sm">
        <span dir="ltr" className="font-semibold text-ink">
          {appointment.startTime}
        </span>
        <span dir="ltr" className="text-xs text-ink-muted">
          {appointment.endTime}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tracking-tight text-ink">
              {appointment.serviceName}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
            >
              {meta.label}
            </span>
            {appointment.arrivalConfirmed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                ✅ אישר/ה הגעה
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-ink">{appointment.clientName}</span>
            <a
              href={`tel:${appointment.clientPhone}`}
              dir="ltr"
              className="text-ink-muted transition-colors hover:text-ink"
            >
              {appointment.clientPhone}
            </a>
            <span className="font-medium text-owner">
              {formatPrice(appointment.priceCentsSnapshot)}
            </span>
          </div>
        </div>

        {actions.length > 0 && (
          <div className="flex items-center gap-2">
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
      </div>
    </li>
  );
}

function actionClass(variant: ActionVariant): string {
  const base =
    "cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60";
  if (variant === "primary") {
    return `${base} bg-owner text-white hover:scale-[1.03]`;
  }
  return `${base} bg-danger-soft text-danger hover:brightness-95`;
}

export function AgendaSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="w-14 shrink-0 pt-3">
            <div className="mx-auto h-4 w-10 animate-pulse rounded bg-line" />
          </div>
          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-4 shadow-soft">
            <div className="h-5 w-40 animate-pulse rounded bg-line" />
            <div className="h-4 w-56 animate-pulse rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
