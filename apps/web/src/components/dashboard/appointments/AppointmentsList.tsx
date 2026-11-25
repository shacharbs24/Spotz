"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { AgendaRow, AgendaSkeleton, toDateStr } from "./AgendaRow";

const AGENDA_DAYS = 14;
const DAYS_PER_WEEK = 7;

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
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + i,
    );
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
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDate = days[selectedDayIndex].value;
  const weekStart =
    Math.floor(selectedDayIndex / DAYS_PER_WEEK) * DAYS_PER_WEEK;
  const visibleDays = days.slice(weekStart, weekStart + DAYS_PER_WEEK);
  const hasPreviousWeek = weekStart > 0;
  const hasNextWeek = weekStart + DAYS_PER_WEEK < days.length;

  const utils = trpc.useUtils();
  const appointmentsQuery = trpc.appointments.getDashboardAppointments.useQuery(
    {
      date: selectedDate,
    },
  );

  const updateStatus = trpc.appointments.updateAppointmentStatus.useMutation({
    onSuccess: () => utils.appointments.getDashboardAppointments.invalidate(),
  });

  const appointments = appointmentsQuery.data ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        aria-labelledby="appointment-date-picker"
        className="rounded-xl border border-line bg-surface-raised p-3 sm:p-4"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3">
          <h2 id="appointment-date-picker" className="font-semibold">
            בחירת תאריך
          </h2>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              aria-disabled={!hasPreviousWeek}
              onClick={() => {
                if (hasPreviousWeek)
                  setSelectedDayIndex(weekStart - DAYS_PER_WEEK);
              }}
              className="min-h-11 rounded-lg px-2 text-sm font-medium text-owner enabled:cursor-pointer hover:bg-owner-soft aria-disabled:cursor-default aria-disabled:opacity-55 aria-disabled:hover:bg-transparent"
            >
              שבוע קודם
            </button>
            <button
              type="button"
              aria-disabled={!hasNextWeek}
              onClick={() => {
                if (hasNextWeek) setSelectedDayIndex(weekStart + DAYS_PER_WEEK);
              }}
              className="min-h-11 rounded-lg px-2 text-sm font-medium text-owner enabled:cursor-pointer hover:bg-owner-soft aria-disabled:cursor-default aria-disabled:opacity-55 aria-disabled:hover:bg-transparent"
            >
              שבוע הבא
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 min-[26rem]:grid-cols-7">
          {visibleDays.map((day, offset) => {
            const index = weekStart + offset;
            const selected = index === selectedDayIndex;
            return (
              <button
                key={day.value}
                type="button"
                aria-label={
                  index === 0
                    ? `היום, ${formatHeading(day.value)}`
                    : formatHeading(day.value)
                }
                aria-pressed={selected}
                onClick={() => setSelectedDayIndex(index)}
                className={`flex min-h-11 min-w-0 cursor-pointer flex-col items-center justify-center rounded-lg border px-1 py-1.5 transition-colors ${
                  selected
                    ? "border-owner bg-owner text-white"
                    : "border-line text-ink-muted hover:border-owner hover:bg-owner-soft"
                }`}
              >
                <span className="text-xs">{day.weekday}</span>
                <bdi dir="ltr" className="text-sm font-semibold tabular-nums">
                  {day.dayMonth}
                </bdi>
              </button>
            );
          })}
        </div>
      </section>

      <h2 className="text-base font-semibold text-ink">
        {formatHeading(selectedDate)}
      </h2>

      {appointmentsQuery.isLoading ? (
        <div role="status">
          <span className="sr-only">טוענים את רשימת התורים…</span>
          <AgendaSkeleton />
        </div>
      ) : appointmentsQuery.isError && !appointmentsQuery.data ? (
        <QueryFailure
          message="לא הצלחנו לטעון את התורים לתאריך הזה."
          onRetry={() => void appointmentsQuery.refetch()}
          retrying={appointmentsQuery.isFetching}
        />
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-14 text-center text-ink-muted">
          אין תורים בתאריך זה.
        </div>
      ) : (
        <ol className="divide-y divide-line rounded-xl border border-line bg-surface-raised">
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
              updateError={
                updateStatus.variables?.id === appointment.id
                  ? updateStatus.error?.message
                  : undefined
              }
            />
          ))}
        </ol>
      )}
    </div>
  );
}
