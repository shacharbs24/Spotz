"use client";

import { useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/trpc/client";
import { Modal } from "@/components/ui/Modal";
import { formatPrice } from "@/lib/format";
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

const MAX_DAYS_SHOWN = 60; // UI safety cap

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
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
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
  const [confirmed, setConfirmed] = useState<{ date: string; time: string } | null>(
    null,
  );

  const slotsQuery = trpc.public.getAvailableSlots.useQuery(
    { businessId, serviceId: service.id, date: selectedDate ?? "" },
    { enabled: open && !!selectedDate && !confirmed },
  );

  const createAppointment = trpc.public.createAppointment.useMutation({
    onSuccess: (res) => setConfirmed({ date: res.date, time: res.time }),
    onError: () => {
      // A taken slot may have changed — refresh availability.
      void utils.public.getAvailableSlots.invalidate();
    },
  });

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    createAppointment.mutate({
      businessId,
      serviceId: service.id,
      date: selectedDate,
      time: selectedTime,
    });
  };

  const slots = slotsQuery.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={confirmed ? "התור נקבע!" : "קביעת תור"}
    >
      {confirmed ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-owner-soft text-2xl text-owner">
            ✓
          </div>
          <h3 className="text-lg font-semibold text-ink">התור נקבע בהצלחה!</h3>
          <p className="text-sm leading-6 text-ink-muted">
            {service.name}
            <br />
            {formatDateHe(confirmed.date)} בשעה {confirmed.time}
          </p>
          <p className="text-xs text-ink-muted">סטטוס: ממתין לאישור העסק</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 cursor-pointer rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
          >
            סגירה
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
            <span className="font-medium text-ink">{service.name}</span>
            <span className="text-sm font-semibold text-owner">
              {formatPrice(service.priceCents, service.currency)}
            </span>
          </div>

          <Step n={1} label="בחרו תאריך">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => handleSelectDate(day.value)}
                  className={dayButtonClass(selectedDate === day.value)}
                >
                  <span className="text-xs">{day.weekday}</span>
                  <span className="text-sm font-semibold">{day.dayMonth}</span>
                </button>
              ))}
            </div>
          </Step>

          {selectedDate && (
            <Step n={2} label="בחרו שעה">
              {slotsQuery.isLoading ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-9 animate-pulse rounded-xl bg-line"
                    />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  אין תורים פנויים ביום זה. נסו תאריך אחר.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((time) => (
                    <button
                      key={time}
                      type="button"
                      dir="ltr"
                      onClick={() => setSelectedTime(time)}
                      className={slotButtonClass(selectedTime === time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
            </Step>
          )}

          {selectedDate && selectedTime && (
            <Step n={3} label="אישור">
              <div className="flex flex-col gap-4">
                {createAppointment.error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-client-soft px-4 py-3 text-sm text-client"
                  >
                    {createAppointment.error.message}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={createAppointment.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createAppointment.isPending ? "קובע תור…" : "אישור וקביעת תור"}
                </button>
              </div>
            </Step>
          )}
        </div>
      )}
    </Modal>
  );
}

function Step({
  n,
  label,
  children,
}: {
  n: number;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-owner-soft text-xs font-semibold text-owner">
          {n}
        </span>
        <span className="text-sm font-semibold text-ink">{label}</span>
      </div>
      {children}
    </div>
  );
}

function dayButtonClass(selected: boolean): string {
  return `flex w-16 shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-colors ${
    selected
      ? "border-owner bg-owner-soft text-owner"
      : "border-line text-ink-muted hover:border-owner/40"
  }`;
}

function slotButtonClass(selected: boolean): string {
  return `rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
    selected
      ? "border-owner bg-owner text-white"
      : "border-line text-ink hover:border-owner/50"
  }`;
}
