"use client";

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { AgendaRow, AgendaSkeleton, toDateStr } from "./AgendaRow";
import type { AppointmentRow } from "@/trpc/types";

/**
 * Today's agenda for the owner dashboard landing. A focused, date-locked view
 * (no day picker) so the owner sees the day's appointments immediately. The
 * full multi-day agenda lives at /dashboard/appointments.
 */
export function TodayAppointments() {
  const today = useMemo(() => toDateStr(new Date()), []);

  const utils = trpc.useUtils();
  const appointmentsQuery = trpc.appointments.getDashboardAppointments.useQuery(
    {
      date: today,
    },
  );

  const updateStatus = trpc.appointments.updateAppointmentStatus.useMutation({
    onSuccess: () => utils.appointments.getDashboardAppointments.invalidate(),
  });

  // Elapsed appointments belong to history, not the day's active agenda.
  const appointments = (appointmentsQuery.data ?? []).filter(
    (appointment) => !appointment.isPast,
  );
  const upcoming = appointments.find(({ status }) => status === "CONFIRMED");
  const pending = appointments.filter(({ status }) => status === "PENDING");

  return (
    <section aria-labelledby="today-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <div>
          <h2
            id="today-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            יומן היום
          </h2>
          {appointments[0] && (
            <p className="mt-0.5 text-sm text-ink-muted">
              {appointments[0].date}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/appointments"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-owner hover:bg-owner-soft"
        >
          לכל התורים
        </Link>
      </div>

      {appointmentsQuery.isLoading ? (
        <div role="status">
          <span className="sr-only">טוענים את יומן היום…</span>
          <AgendaSkeleton />
        </div>
      ) : appointmentsQuery.isError && !appointmentsQuery.data ? (
        <QueryFailure
          message="לא הצלחנו לטעון את התורים של היום."
          onRetry={() => void appointmentsQuery.refetch()}
          retrying={appointmentsQuery.isFetching}
        />
      ) : appointments.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface-raised p-5 sm:p-6">
          <p className="font-semibold">אין תורים נוספים להיום</p>
          <p className="mt-1 text-sm text-ink-muted">
            אפשר לעבור לכל התורים כדי לראות את הימים הבאים.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <section className="min-w-0 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
              <h3 className="font-semibold">התור המאושר הקרוב</h3>
              {upcoming ? (
                <a
                  href={`#appointment-${upcoming.id}`}
                  className="mt-3 flex min-h-11 items-baseline gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface"
                >
                  <time
                    dateTime={upcoming.startTime}
                    dir="ltr"
                    className="shrink-0 text-2xl leading-none font-semibold text-owner tabular-nums"
                  >
                    {upcoming.startTime}
                  </time>
                  <span className="min-w-0 break-words">
                    <span className="block font-semibold">
                      {upcoming.serviceName}
                      {upcoming.staffName && (
                        <span className="font-normal text-ink-muted">
                          {" "}
                          · <bdi>{upcoming.staffName}</bdi>
                        </span>
                      )}
                    </span>
                    <bdi className="block text-sm text-ink-muted">
                      {upcoming.clientName}
                    </bdi>
                  </span>
                </a>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">
                  אין תור מאושר נוסף להיום.
                </p>
              )}
            </section>

            <section className="min-w-0 rounded-xl border border-line bg-surface-raised p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="font-semibold">ממתינים לאישור היום</h3>
                {pending.length > 0 && (
                  <span className="rounded-full bg-pending-soft px-2.5 py-0.5 text-sm font-semibold text-pending tabular-nums">
                    {pending.length}
                  </span>
                )}
              </div>
              {pending.length > 0 ? (
                <ul className="mt-2 divide-y divide-line">
                  {pending.slice(0, 2).map((appointment) => (
                    <PendingAppointment
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                  {pending.length > 2 && (
                    <li>
                      <a
                        href="#remaining-appointments"
                        className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-owner hover:bg-owner-soft"
                      >
                        לכל התורים של היום
                      </a>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">
                  אין בקשות פתוחות להיום.
                </p>
              )}
            </section>
          </div>

          <h3
            id="remaining-appointments"
            tabIndex={-1}
            className="mt-2 text-lg font-semibold"
          >
            התורים שנותרו היום
          </h3>
          <ol
            aria-labelledby="remaining-appointments"
            className="divide-y divide-line rounded-xl border border-line bg-surface-raised"
          >
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
        </>
      )}
    </section>
  );
}

function PendingAppointment({ appointment }: { appointment: AppointmentRow }) {
  return (
    <li>
      <a
        href={`#appointment-${appointment.id}`}
        className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface"
      >
        <time
          dateTime={appointment.startTime}
          dir="ltr"
          className="shrink-0 text-sm font-semibold text-owner tabular-nums"
        >
          {appointment.startTime}
        </time>
        <bdi className="min-w-0 break-words text-sm font-medium">
          {appointment.clientName}
        </bdi>
      </a>
    </li>
  );
}
