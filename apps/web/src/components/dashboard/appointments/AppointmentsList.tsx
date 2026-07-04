"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { AgendaRow, AgendaSkeleton, toDateStr } from "./AgendaRow";

const AGENDA_DAYS = 14;

interface AgendaDay {
  value: string;
  weekday: string;
  dayMonth: string;
}

function buildAgendaDays(): AgendaDay[] {
  const fmtWeekday = new Intl.DateTimeFormat("he-IL", { weekday: "short" });
  const fmtDayMonth = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
  });
  const today = new Date();
  return Array.from({ length: AGENDA_DAYS }, (_unused, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return {
      value: toDateStr(d),
      weekday: i === 0 ? "היום" : fmtWeekday.format(d),
      dayMonth: fmtDayMonth.format(d),
    };
  });
}

function formatHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(y, m - 1, d));
}

export function AppointmentsList() {
  const days = useMemo(() => buildAgendaDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0].value);

  const utils = trpc.useUtils();
  const appointmentsQuery = trpc.appointments.getDashboardAppointments.useQuery({
    date: selectedDate,
  });

  const updateStatus = trpc.appointments.updateAppointmentStatus.useMutation({
    onSuccess: () => utils.appointments.getDashboardAppointments.invalidate(),
  });

  const appointments = appointmentsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Date selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => {
          const selected = day.value === selectedDate;
          return (
            <button
              key={day.value}
              type="button"
              onClick={() => setSelectedDate(day.value)}
              className={`flex w-16 shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-colors ${
                selected
                  ? "border-owner bg-owner-soft text-owner"
                  : "border-line text-ink-muted hover:border-owner/40"
              }`}
            >
              <span className="text-xs">{day.weekday}</span>
              <span className="text-sm font-semibold">{day.dayMonth}</span>
            </button>
          );
        })}
      </div>

      <h2 className="text-sm font-semibold text-ink">
        {formatHeading(selectedDate)}
      </h2>

      {appointmentsQuery.isLoading ? (
        <AgendaSkeleton />
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-14 text-center text-ink-muted">
          אין תורים בתאריך זה.
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {appointments.map((appointment) => (
            <AgendaRow
              key={appointment.id}
              appointment={appointment}
              onChangeStatus={(status) =>
                updateStatus.mutate({ id: appointment.id, status })
              }
              isUpdating={
                updateStatus.isPending &&
                updateStatus.variables?.id === appointment.id
              }
            />
          ))}
        </ol>
      )}
    </div>
  );
}
