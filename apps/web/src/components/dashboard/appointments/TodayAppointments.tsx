"use client";

import { useMemo } from "react";
import { trpc } from "@/trpc/client";
import { AgendaRow, AgendaSkeleton, toDateStr } from "./AgendaRow";

/**
 * Today's agenda for the owner dashboard landing. A focused, date-locked view
 * (no day picker) so the owner sees the day's appointments immediately. The
 * full multi-day agenda lives at /dashboard/appointments.
 */
export function TodayAppointments() {
  const today = useMemo(() => toDateStr(new Date()), []);

  const utils = trpc.useUtils();
  const appointmentsQuery = trpc.appointments.getDashboardAppointments.useQuery({
    date: today,
  });

  const updateStatus = trpc.appointments.updateAppointmentStatus.useMutation({
    onSuccess: () => utils.appointments.getDashboardAppointments.invalidate(),
  });

  // Elapsed appointments belong to history, not the day's active agenda.
  const appointments = (appointmentsQuery.data ?? []).filter(
    (appointment) => !appointment.isPast,
  );

  if (appointmentsQuery.isLoading) {
    return <AgendaSkeleton />;
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-14 text-center text-ink-muted">
        אין תורים נוספים להיום.
      </div>
    );
  }

  return (
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
  );
}
