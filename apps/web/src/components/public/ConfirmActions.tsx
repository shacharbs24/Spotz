"use client";

import { useState, type ReactNode } from "react";
import { trpc } from "@/trpc/client";
import type { AppointmentStatus } from "@spotz/api/schemas/appointment";

interface ConfirmActionsProps {
  appointmentId: string;
  initialStatus: AppointmentStatus;
}

export function ConfirmActions({
  appointmentId,
  initialStatus,
}: ConfirmActionsProps) {
  const [result, setResult] = useState<"CONFIRMED" | "CANCELLED" | null>(null);

  const update = trpc.public.updateAppointmentStatusPublic.useMutation({
    onSuccess: (res) => setResult(res.status as "CONFIRMED" | "CANCELLED"),
  });

  // What the page should reflect: a just-made choice, or an already-handled appt.
  const outcome: AppointmentStatus | null =
    result ?? (initialStatus !== "PENDING" ? initialStatus : null);

  if (outcome === "CONFIRMED") {
    return (
      <Outcome
        tone="success"
        icon="✓"
        title="תודה! אישרת את הגעתך"
        subtitle="נתראה בקרוב 🙂"
      />
    );
  }
  if (outcome === "CANCELLED") {
    return (
      <Outcome
        tone="danger"
        icon="✕"
        title="התור בוטל"
        subtitle="תודה שעדכנת אותנו."
      />
    );
  }
  if (outcome === "COMPLETED") {
    return <Outcome tone="muted" icon="✓" title="התור כבר הושלם" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {update.error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-4 py-3 text-center text-sm text-danger"
        >
          {update.error.message}
        </p>
      )}

      <button
        type="button"
        disabled={update.isPending}
        onClick={() =>
          update.mutate({ appointmentId, status: "CONFIRMED" })
        }
        className="w-full cursor-pointer rounded-2xl bg-success px-6 py-4 text-base font-semibold text-white transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
      >
        אני מגיע
      </button>

      <button
        type="button"
        disabled={update.isPending}
        onClick={() =>
          update.mutate({ appointmentId, status: "CANCELLED" })
        }
        className="w-full cursor-pointer rounded-2xl border border-danger/40 bg-danger-soft px-6 py-4 text-base font-semibold text-danger transition-colors duration-200 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ביטול תור
      </button>
    </div>
  );
}

interface OutcomeProps {
  tone: "success" | "danger" | "muted";
  icon: string;
  title: string;
  subtitle?: string;
}

function Outcome({ tone, icon, title, subtitle }: OutcomeProps): ReactNode {
  const circle =
    tone === "success"
      ? "bg-success-soft text-success"
      : tone === "danger"
        ? "bg-danger-soft text-danger"
        : "bg-line text-ink-muted";

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${circle}`}
      >
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
    </div>
  );
}
