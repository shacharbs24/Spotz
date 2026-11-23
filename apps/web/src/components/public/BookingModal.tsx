"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { Modal } from "@/components/ui/Modal";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { formatDuration, formatPrice } from "@/lib/format";
import type { PublicService } from "@/trpc/types";

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  service: PublicService;
  /** Latest bookable date ("YYYY-MM-DD"), from the business booking window. */
  maxBookingDate: string;
}

interface DayOption {
  value: string; // YYYY-MM-DD
  weekday: string;
  dayMonth: string;
}

const MAX_DAYS_SHOWN = 366; // schema allows today + up to 365 days
const DAYS_PER_PAGE = 7;

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Days from today up to (and including) `maxDate`, capped for UI sanity. */
function buildDays(maxDate: string): DayOption[] {
  const fmtWeekday = new Intl.DateTimeFormat("he-IL", { weekday: "short" });
  const fmtDayMonth = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
  });
  const today = new Date();
  const days: DayOption[] = [];
  for (let i = 0; i < MAX_DAYS_SHOWN; i++) {
    const d = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + i,
    );
    const value = toDateStr(d);
    if (value > maxDate) break; // beyond the booking window
    days.push({
      value,
      weekday: i === 0 ? "היום" : fmtWeekday.format(d),
      dayMonth: fmtDayMonth.format(d),
    });
  }
  return days;
}

function formatDateHe(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(y, m - 1, d));
}

export function BookingModal({
  open,
  onClose,
  businessId,
  service,
  maxBookingDate,
}: BookingModalProps) {
  const utils = trpc.useUtils();
  const days = useMemo(() => buildDays(maxBookingDate), [maxBookingDate]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [firstVisibleDay, setFirstVisibleDay] = useState(0);
  const [confirmed, setConfirmed] = useState<{
    date: string;
    time: string;
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  } | null>(null);

  const slotsQuery = trpc.public.getAvailableSlots.useQuery(
    { businessId, serviceId: service.id, date: selectedDate ?? "" },
    { enabled: open && !!selectedDate && !confirmed },
  );

  const createAppointment = trpc.public.createAppointment.useMutation({
    onSuccess: (res) =>
      setConfirmed({ date: res.date, time: res.time, status: res.status }),
    onError: () => {
      // A taken slot may have changed — refresh availability.
      void utils.public.getAvailableSlots.invalidate();
    },
  });

  const handleSelectDate = (date: string) => {
    if (date === selectedDate) return;
    createAppointment.reset();
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const slots = slotsQuery.data ?? [];
  const availableSelection =
    selectedTime !== null && slots.includes(selectedTime);
  const visibleDays = days.slice(
    firstVisibleDay,
    firstVisibleDay + DAYS_PER_PAGE,
  );
  const price = formatPrice(service.priceCents, service.currency);

  const handleConfirm = () => {
    if (
      !selectedDate ||
      !selectedTime ||
      !availableSelection ||
      createAppointment.isPending
    )
      return;
    createAppointment.mutate({
      businessId,
      serviceId: service.id,
      date: selectedDate,
      time: selectedTime,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        confirmed
          ? confirmed.status === "CONFIRMED"
            ? "התור אושר!"
            : "הבקשה נשלחה!"
          : "קביעת תור"
      }
    >
      {confirmed ? (
        <div className="flex flex-col gap-4">
          <div
            role="status"
            className="flex flex-col items-start gap-2 border-b border-line pb-4"
          >
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                confirmed.status === "CONFIRMED"
                  ? "bg-success-soft text-success"
                  : "bg-pending-soft text-pending"
              }`}
            >
              {confirmed.status === "CONFIRMED" ? "מאושר" : "ממתין לאישור העסק"}
            </span>
            <p className="text-base font-semibold">{service.name}</p>
            <p className="text-sm text-ink-muted">
              {formatDateHe(confirmed.date)} בשעה{" "}
              <bdi dir="ltr" className="tabular-nums">
                {confirmed.time}
              </bdi>
            </p>
          </div>
          <button type="button" onClick={onClose} className="action-primary">
            סיום
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
            <div className="min-w-0">
              <p className="font-semibold break-words">{service.name}</p>
              <p className="text-sm text-ink-muted">
                {formatDuration(service.durationMinutes)}
              </p>
            </div>
            <bdi className="shrink-0 font-semibold tabular-nums">{price}</bdi>
          </div>

          <fieldset className="min-w-0" disabled={createAppointment.isPending}>
            <legend className="mb-2 font-semibold">בחרו תאריך</legend>
            {days.length === 0 && (
              <p className="text-sm text-ink-muted">
                אין כרגע תאריכים פתוחים להזמנה.
              </p>
            )}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {visibleDays.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  aria-label={
                    day.weekday === "היום"
                      ? `היום, ${formatDateHe(day.value)}`
                      : formatDateHe(day.value)
                  }
                  aria-pressed={selectedDate === day.value}
                  onClick={() => handleSelectDate(day.value)}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-sm transition-colors ${choiceClass(selectedDate === day.value)}`}
                >
                  <span className="text-xs">{day.weekday}</span>
                  <span className="text-sm font-semibold">{day.dayMonth}</span>
                </button>
              ))}
            </div>
            {days.length > DAYS_PER_PAGE && (
              <div className="mt-1 flex flex-wrap justify-between gap-1">
                <button
                  type="button"
                  aria-disabled={firstVisibleDay === 0}
                  onClick={() => {
                    if (firstVisibleDay > 0)
                      setFirstVisibleDay(firstVisibleDay - DAYS_PER_PAGE);
                  }}
                  className="min-h-11 rounded-lg px-2 text-sm font-medium text-owner hover:bg-owner-soft aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
                >
                  לתאריכים הקודמים
                </button>
                <button
                  type="button"
                  aria-disabled={firstVisibleDay + DAYS_PER_PAGE >= days.length}
                  onClick={() => {
                    if (firstVisibleDay + DAYS_PER_PAGE < days.length)
                      setFirstVisibleDay(firstVisibleDay + DAYS_PER_PAGE);
                  }}
                  className="ms-auto min-h-11 rounded-lg px-2 text-sm font-medium text-owner hover:bg-owner-soft aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
                >
                  לתאריכים הבאים
                </button>
              </div>
            )}
          </fieldset>

          {selectedDate && (
            <fieldset
              className="min-w-0"
              disabled={createAppointment.isPending}
            >
              <legend className="mb-2 font-semibold">בחרו שעה</legend>
              <p className="mb-2 text-sm text-ink-muted">
                {formatDateHe(selectedDate)}
              </p>
              {slotsQuery.isLoading ? (
                <div
                  className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                  role="status"
                >
                  <span className="sr-only">טוען שעות פנויות…</span>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      aria-hidden="true"
                      className="h-11 animate-pulse rounded-lg bg-line"
                    />
                  ))}
                </div>
              ) : slotsQuery.isError ? (
                <QueryFailure
                  message="לא הצלחנו לטעון את השעות הפנויות."
                  onRetry={() => void slotsQuery.refetch()}
                  retrying={slotsQuery.isFetching}
                />
              ) : slots.length === 0 ? (
                <p role="status" className="text-sm text-ink-muted">
                  אין תורים פנויים ביום זה. נסו תאריך אחר.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((time) => (
                    <button
                      key={time}
                      type="button"
                      dir="ltr"
                      aria-pressed={selectedTime === time}
                      onClick={() => {
                        createAppointment.reset();
                        setSelectedTime(time);
                      }}
                      className={`min-h-11 rounded-lg border px-2 py-1.5 text-sm font-medium tabular-nums transition-colors ${choiceClass(selectedTime === time)}`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {createAppointment.error && (
            <p
              role="alert"
              className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {createAppointment.error.message}
            </p>
          )}
          {selectedDate &&
            selectedTime &&
            !availableSelection &&
            !slotsQuery.isError &&
            !slotsQuery.isFetching && (
              <p role="status" className="text-sm text-ink-muted">
                השעה שבחרתם כבר אינה זמינה. בחרו שעה אחרת.
              </p>
            )}
          {selectedDate &&
            selectedTime &&
            availableSelection &&
            !slotsQuery.isError && (
              <section
                aria-label="סיכום התור"
                className="flex flex-col gap-3 rounded-xl bg-surface p-4"
              >
                <h3 className="font-semibold">סיכום התור</h3>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-ink-muted">שירות</dt>
                  <dd className="break-words">{service.name}</dd>
                  <dt className="text-ink-muted">מועד</dt>
                  <dd>
                    {formatDateHe(selectedDate)} בשעה{" "}
                    <bdi dir="ltr" className="tabular-nums">
                      {selectedTime}
                    </bdi>
                  </dd>
                  <dt className="text-ink-muted">מחיר</dt>
                  <dd>
                    <bdi className="font-semibold tabular-nums">{price}</bdi>
                  </dd>
                </dl>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={createAppointment.isPending}
                  className="action-primary"
                >
                  {createAppointment.isPending
                    ? "שולח את הבקשה…"
                    : "אישור וקביעת תור"}
                </button>
              </section>
            )}
        </div>
      )}
    </Modal>
  );
}

function choiceClass(selected: boolean): string {
  const state = selected
    ? "border-owner bg-owner text-white"
    : "border-control bg-surface-raised text-ink hover:border-owner hover:bg-owner-soft";
  return `cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${state}`;
}
