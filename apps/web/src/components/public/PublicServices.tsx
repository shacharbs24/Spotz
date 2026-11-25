"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { formatDuration, formatPrice } from "@/lib/format";
import { trpc } from "@/trpc/client";
import type { PublicBusinessData, PublicService } from "@/trpc/types";
import { BookingCalendar, formatBookingDate } from "./BookingCalendar";

export type BookingAuthState = "guest" | "needs-onboarding" | "ready";

interface PublicServicesProps {
  businessId: string;
  services: PublicService[];
  staffMembers: PublicBusinessData["staffMembers"];
  minBookingDate: string;
  maxBookingDate: string;
  authState: BookingAuthState;
  slug: string;
  resumeServiceId?: string;
}

type CalendarOption = { id: string | null; name: string };
const businessCalendar = { id: null, name: "יומן העסק" };
const steps = [
  "בחירת שירות",
  "בחירת איש צוות",
  "בחירת תאריך",
  "בחירת שעה",
  "סיכום התור",
] as const;
type Step = 0 | 1 | 2 | 3 | 4;
const optionClass =
  "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-3 text-start transition-colors hover:border-owner hover:bg-owner-soft/40 sm:px-4";

function OptionArrow() {
  return (
    <span
      dir="ltr"
      aria-hidden="true"
      className="shrink-0 text-xl leading-none text-owner"
    >
      ‹
    </span>
  );
}

export function PublicServices(props: PublicServicesProps) {
  if (props.services.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-8 text-center">
        <h2 id="services-heading" className="font-bold text-ink">
          השירותים שלנו
        </h2>
        <p className="mt-2 text-sm text-ink-muted">השירותים יתווספו בקרוב.</p>
      </div>
    );
  }
  return <BookingFlow {...props} />;
}

function BookingFlow({
  businessId,
  services,
  staffMembers,
  minBookingDate,
  maxBookingDate,
  authState,
  slug,
  resumeServiceId,
}: PublicServicesProps) {
  const [step, setStep] = useState<Step>(resumeServiceId ? 1 : 0);
  const [serviceId, setServiceId] = useState(resumeServiceId);
  const [staff, setStaff] = useState<CalendarOption>();
  const [month, setMonth] = useState(minBookingDate.slice(0, 7));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(Boolean(resumeServiceId));
  const utils = trpc.useUtils();
  const service = services.find((item) => item.id === serviceId);
  const calendarInput = {
    businessId,
    serviceId: serviceId ?? "",
    staffMemberId: staff?.id ?? undefined,
  };
  const datesQuery = trpc.public.getAvailableDates.useQuery(
    { ...calendarInput, month },
    { enabled: step === 2 && Boolean(service && staff) },
  );
  const slotsQuery = trpc.public.getAvailableSlots.useQuery(
    { ...calendarInput, date: date ?? "" },
    { enabled: step >= 3 && Boolean(service && staff && date) },
  );
  const appointment = trpc.public.createAppointment.useMutation({
    onSuccess: () => {
      focusHeading.current = true;
      void utils.public.getAvailableSlots.invalidate();
      void utils.public.getAvailableDates.invalidate();
      void utils.me.getMyAppointments.invalidate();
    },
    onError: () => {
      void utils.public.getAvailableSlots.invalidate();
      void utils.public.getAvailableDates.invalidate();
    },
  });

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ block: "start" });
  }, [step, appointment.isSuccess]);

  function goTo(next: Step) {
    focusHeading.current = true;
    setStep(next);
    if (next === 0) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("booking")) {
        url.searchParams.delete("booking");
        window.history.replaceState(null, "", url);
      }
    }
  }

  function selectService(id: string) {
    if (id !== serviceId) {
      setServiceId(id);
      setStaff(undefined);
      setDate(null);
      setTime(null);
      setMonth(minBookingDate.slice(0, 7));
    }
    goTo(1);
  }

  function selectStaff(member: CalendarOption) {
    if (member.id !== staff?.id) {
      setStaff(member);
      setDate(null);
      setTime(null);
      setMonth(minBookingDate.slice(0, 7));
    }
    goTo(2);
  }

  const stillAvailable = Boolean(
    time && !slotsQuery.isError && slotsQuery.data?.includes(time),
  );

  function confirmBooking() {
    if (
      !service ||
      !staff ||
      !date ||
      !time ||
      !stillAvailable ||
      appointment.isPending
    )
      return;
    appointment.mutate({ ...calendarInput, date, time });
  }

  const booked = appointment.data;
  const title = booked
    ? booked.status === "CONFIRMED"
      ? "התור נקבע"
      : "הבקשה נשלחה"
    : steps[step];

  let content: ReactNode;
  if (booked && service && staff) {
    content = (
      <div className="mx-auto grid max-w-md gap-4">
        <p
          role="status"
          className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success"
        >
          {booked.status === "CONFIRMED"
            ? "מועד התור מופיע ב״התורים שלי״."
            : "התור ממתין לאישור העסק. אפשר לעקוב אחריו ב״התורים שלי״."}
        </p>
        <BookingDetails
          service={service}
          staff={staff}
          date={booked.date}
          time={booked.time}
        />
        <button
          type="button"
          className="action-primary"
          onClick={() => {
            appointment.reset();
            setServiceId(undefined);
            setStaff(undefined);
            setMonth(minBookingDate.slice(0, 7));
            setDate(null);
            setTime(null);
            goTo(0);
          }}
        >
          קביעת תור נוסף
        </button>
      </div>
    );
  } else if (step === 0) {
    content = (
      <>
        {authState !== "ready" && (
          <p className="mb-3 text-sm text-ink-muted">
            {authState === "guest"
              ? "אחרי בחירת השירות תתבקשו להתחבר כדי להמשיך לקביעת תור."
              : "אחרי בחירת השירות תתבקשו להשלים פרטי קשר."}
          </p>
        )}
        <ul className="grid gap-2.5">
          {services.map((item) => (
            <li key={item.id}>
              <ServiceOption
                service={item}
                authState={authState}
                slug={slug}
                onSelect={() => selectService(item.id)}
              />
            </li>
          ))}
        </ul>
      </>
    );
  } else if (step === 1) {
    content = (
      <ul className="grid gap-2.5">
        {[businessCalendar, ...staffMembers].map((member) => (
          <li key={member.id ?? "business"}>
            <button
              type="button"
              onClick={() => selectStaff(member)}
              className={optionClass}
            >
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-owner-soft font-bold text-owner"
              >
                {member.name.trim().slice(0, 1)}
              </span>
              <span className="min-w-0 grow [overflow-wrap:anywhere]">
                <span className="block font-semibold text-ink">
                  <bdi>{member.name}</bdi>
                </span>
                {member.id === null && (
                  <span className="block text-sm text-ink-muted">
                    היומן הכללי של העסק
                  </span>
                )}
              </span>
              <OptionArrow />
            </button>
          </li>
        ))}
      </ul>
    );
  } else if (step === 2) {
    content = (
      <>
        <BookingCalendar
          month={month}
          minDate={minBookingDate}
          maxDate={maxBookingDate}
          dates={datesQuery.isError ? [] : (datesQuery.data ?? [])}
          selectedDate={date}
          loading={datesQuery.isLoading}
          onMonthChange={setMonth}
          onSelect={(nextDate) => {
            if (nextDate !== date) setTime(null);
            setDate(nextDate);
            goTo(3);
          }}
        />
        {datesQuery.isError ? (
          <QueryFailure
            message="לא הצלחנו לטעון את התאריכים הפנויים."
            retrying={datesQuery.isFetching}
            onRetry={() => void datesQuery.refetch()}
          />
        ) : (
          <p role="status" className="mt-3 text-center text-sm text-ink-muted">
            {datesQuery.isLoading
              ? "בודקים זמינות…"
              : datesQuery.data?.length
                ? "בחרו יום מודגש כדי לראות שעות פנויות."
                : "אין תורים פנויים בחודש הזה."}
          </p>
        )}
      </>
    );
  } else if (step === 3 && date) {
    content = (
      <div className="mx-auto grid max-w-md gap-3">
        <p className="text-center font-medium text-ink-muted">
          {formatBookingDate(date)}
        </p>
        {slotsQuery.isError ? (
          <QueryFailure
            message="לא הצלחנו לטעון את השעות הפנויות."
            retrying={slotsQuery.isFetching}
            onRetry={() => void slotsQuery.refetch()}
          />
        ) : slotsQuery.data?.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:gap-3">
            {slotsQuery.data.map((slot) => (
              <li key={slot}>
                <button
                  type="button"
                  aria-pressed={slot === time}
                  className={`min-h-11 w-full cursor-pointer rounded-lg border px-2 font-semibold tabular-nums transition-colors ${slot === time ? "border-owner bg-owner-soft text-owner" : "border-line bg-surface hover:border-owner hover:text-owner"}`}
                  onClick={() => {
                    setTime(slot);
                    appointment.reset();
                    goTo(4);
                  }}
                >
                  <bdi>{slot}</bdi>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p
            role="status"
            className="rounded-lg bg-surface p-4 text-center text-sm text-ink-muted"
          >
            {slotsQuery.isLoading
              ? "טוענים שעות פנויות…"
              : "אין שעות פנויות ביום הזה. חזרו ללוח ובחרו יום אחר."}
          </p>
        )}
      </div>
    );
  } else if (step === 4 && service && staff && date && time) {
    content = (
      <div className="mx-auto grid max-w-md gap-4">
        <BookingDetails
          service={service}
          staff={staff}
          date={date}
          time={time}
        />
        {slotsQuery.isError ? (
          <QueryFailure
            message="לא הצלחנו לבדוק אם השעה עדיין פנויה."
            retrying={slotsQuery.isFetching}
            onRetry={() => void slotsQuery.refetch()}
          />
        ) : appointment.error ||
          (!stillAvailable &&
            !slotsQuery.isLoading &&
            !appointment.isPending) ? (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {appointment.error?.message ??
              "השעה כבר אינה פנויה. חזרו לבחירת שעה."}
          </p>
        ) : null}
        <button
          type="button"
          className="action-primary"
          disabled={!stillAvailable || appointment.isPending}
          onClick={confirmBooking}
        >
          {appointment.isPending ? "שומרים את התור…" : "אישור וקביעת תור"}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      dir="rtl"
      className="scroll-mt-4 rounded-2xl border border-line bg-surface-raised px-3 py-4 shadow-soft sm:px-6 sm:py-6"
    >
      <div className="mx-auto max-w-xl">
        <div className="mb-2 grid grid-cols-5 gap-1.5" aria-hidden="true">
          {steps.map((label, index) => (
            <span
              key={label}
              className={`h-1 rounded-full motion-safe:transition-colors ${index <= step ? "bg-owner" : "bg-line"}`}
            />
          ))}
        </div>
        <div className="grid min-h-11 grid-cols-[1fr_auto_1fr] items-center">
          {step > 0 && !booked && (
            <button
              type="button"
              disabled={appointment.isPending}
              onClick={() => goTo((step - 1) as Step)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1 justify-self-start rounded-md px-1.5 text-sm font-semibold text-owner hover:bg-owner-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                dir="ltr"
                aria-hidden="true"
                className="text-xl leading-none"
              >
                ›
              </span>{" "}
              חזרה
            </button>
          )}
          {!booked && (
            <span
              className="col-start-2 text-xs font-medium text-ink-muted"
              aria-hidden="true"
            >
              שלב {step + 1} מתוך {steps.length}
            </span>
          )}
        </div>
        <h2
          id="services-heading"
          tabIndex={-1}
          ref={headingRef}
          className="mb-1 scroll-mt-6 rounded-sm text-center text-2xl font-bold tracking-tight text-ink"
        >
          {title}
          {!booked && (
            <span className="sr-only">
              , שלב {step + 1} מתוך {steps.length}
            </span>
          )}
        </h2>
        {!booked && step > 0 && step < 4 && service && (
          <p className="break-words text-center text-sm text-ink-muted">
            <bdi>{service.name}</bdi>
            {step > 1 && staff && (
              <>
                {" "}
                · <bdi>{staff.name}</bdi>
              </>
            )}
          </p>
        )}
        <div className="mt-4">{content}</div>
      </div>
    </div>
  );
}

function ServiceOption({
  service,
  authState,
  slug,
  onSelect,
}: {
  service: PublicService;
  authState: BookingAuthState;
  slug: string;
  onSelect: () => void;
}) {
  const returnUrl = `/b/${encodeURIComponent(slug)}?${new URLSearchParams({ booking: service.id })}`;
  const details = (
    <>
      <span className="min-w-0 grow">
        <span className="block break-words font-semibold text-ink">
          {service.name}
        </span>
        <span className="mt-0.5 block text-sm text-ink-muted">
          {formatDuration(service.durationMinutes)}
        </span>
        {service.description && (
          <span className="mt-1 block break-words text-sm leading-6 text-ink-muted">
            {service.description}
          </span>
        )}
      </span>
      <bdi className="shrink-0 text-sm font-bold whitespace-nowrap text-ink tabular-nums sm:text-base">
        {formatPrice(service.priceCents, service.currency)}
      </bdi>
      <OptionArrow />
    </>
  );
  if (authState === "guest") {
    return (
      <SignInButton
        mode="modal"
        forceRedirectUrl={returnUrl}
        signUpForceRedirectUrl={returnUrl}
      >
        <button type="button" className={optionClass}>
          {details}
          <span className="sr-only">, התחברות לקביעת תור</span>
        </button>
      </SignInButton>
    );
  }
  if (authState === "needs-onboarding") {
    return (
      <Link
        href={`/onboarding?redirect=${encodeURIComponent(returnUrl)}`}
        className={optionClass}
      >
        {details}
        <span className="sr-only">, השלמת פרטים לקביעת תור</span>
      </Link>
    );
  }
  return (
    <button type="button" className={optionClass} onClick={onSelect}>
      {details}
    </button>
  );
}

function BookingDetails({
  service,
  staff,
  date,
  time,
}: {
  service: PublicService;
  staff: CalendarOption;
  date: string;
  time: string;
}) {
  return (
    <dl className="divide-y divide-line rounded-xl border border-line bg-surface px-3 sm:px-4">
      <BookingDetail label="שירות">
        <bdi>{service.name}</bdi>
        <span className="block font-medium text-ink-muted">
          {formatDuration(service.durationMinutes)}
        </span>
      </BookingDetail>
      <BookingDetail label="איש צוות">
        <bdi>{staff.name}</bdi>
      </BookingDetail>
      <BookingDetail label="תאריך ושעה">
        <span className="block">{formatBookingDate(date)}</span>
        <span className="block tabular-nums">
          <bdi>{time}</bdi>
        </span>
      </BookingDetail>
      <BookingDetail label="מחיר">
        <bdi>{formatPrice(service.priceCents, service.currency)}</bdi>
      </BookingDetail>
    </dl>
  );
}

function BookingDetail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 py-2.5 text-sm sm:grid-cols-[6rem_minmax(0,1fr)]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold [overflow-wrap:anywhere] text-ink">
        {children}
      </dd>
    </div>
  );
}
