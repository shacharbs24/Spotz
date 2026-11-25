"use client";

import { useState } from "react";
import Link from "next/link";
import { WeeklyHoursForm } from "@/components/dashboard/availability/AvailabilityForm";
import { BlockedPeriodsManager } from "@/components/dashboard/blocked/BlockedPeriodsManager";
import { DashboardHeading } from "@/components/dashboard/DashboardHeading";
import { QueryFailure } from "@/components/ui/QueryFailure";
import { trpc } from "@/trpc/client";
import type { RouterOutputs } from "@/trpc/types";

type Settings = RouterOutputs["staff"]["getSettings"];
const panel =
  "grid gap-3 rounded-xl border border-line bg-surface-raised p-4 sm:p-5";
const checkbox = "size-5 shrink-0 accent-owner";

export function StaffBookingSettings({ memberId }: { memberId: string }) {
  const { data, isError, isFetching, refetch } =
    trpc.staff.getSettings.useQuery({ memberId });

  return (
    <div className="grid min-w-0 w-full max-w-3xl gap-5 sm:gap-6">
      <Link
        href="/dashboard/staff"
        className="inline-flex min-h-11 items-center justify-self-start rounded-md px-1 text-sm font-semibold text-owner hover:underline"
      >
        חזרה לצוות
      </Link>
      <DashboardHeading
        title={data?.name ?? "זמינות ושירותים"}
        description="הגדירו אילו שירותים אפשר להזמין ופתחו שעות ביומן האישי."
      />
      {isError && !data ? (
        <QueryFailure
          message="לא הצלחנו לטעון את הגדרות איש הצוות."
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      ) : !data ? (
        <p role="status" className="text-sm text-ink-muted">
          טוענים הגדרות…
        </p>
      ) : (
        <>
          <ServicesSettings key={`services-${memberId}`} settings={data} />
          <HoursSettings key={`hours-${memberId}`} settings={data} />
          <section aria-labelledby="personal-blocks" className="grid gap-3">
            <div>
              <h2 id="personal-blocks" className="text-xl font-semibold">
                חסימות אישיות
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                חופשה או היעדרות ביומן הזה. חסימות העסק חלות על כל אנשי הצוות.
              </p>
            </div>
            <BlockedPeriodsManager key={memberId} staffMemberId={memberId} />
          </section>
        </>
      )}
    </div>
  );
}

function ServicesSettings({ settings }: { settings: Settings }) {
  const utils = trpc.useUtils();
  const [all, setAll] = useState(settings.serviceIds === null);
  const [picked, setPicked] = useState(
    () =>
      new Set(
        settings.serviceIds ?? settings.activeServices.map(({ id }) => id),
      ),
  );
  const update = trpc.staff.setServices.useMutation({
    onSuccess: ({ serviceIds }) => {
      utils.staff.getSettings.setData(
        { memberId: settings.id },
        (data) => data && { ...data, serviceIds },
      );
      void utils.public.getAvailableDates.invalidate();
      void utils.public.getAvailableSlots.invalidate();
    },
  });

  return (
    <section aria-labelledby="team-services" className={panel}>
      <h2 id="team-services" className="text-xl font-semibold">
        שירותים להזמנה
      </h2>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!update.isPending) {
            update.mutate({
              memberId: settings.id,
              serviceIds: all
                ? null
                : settings.activeServices
                    .filter(({ id }) => picked.has(id))
                    .map(({ id }) => id),
            });
          }
        }}
      >
        <fieldset disabled={update.isPending} className="grid min-w-0 gap-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3">
            <input
              type="checkbox"
              checked={all}
              className={checkbox}
              onChange={(event) => {
                setAll(event.target.checked);
                update.reset();
              }}
            />
            <span className="min-w-0">
              <span className="block font-semibold">כל שירותי העסק</span>
              <span className="block text-sm text-ink-muted">
                כולל שירותים חדשים שתוסיפו בהמשך.
              </span>
            </span>
          </label>
          {!all &&
            (settings.activeServices.length > 0 ? (
              <fieldset className="min-w-0 rounded-lg border border-line px-3">
                <legend className="px-1 text-sm font-semibold">
                  שירותים נבחרים
                </legend>
                <ul className="divide-y divide-line">
                  {settings.activeServices.map(({ id, name }) => (
                    <li key={id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
                        <input
                          type="checkbox"
                          checked={picked.has(id)}
                          className={checkbox}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setPicked((current) => {
                              const next = new Set(current);
                              if (checked) next.add(id);
                              else next.delete(id);
                              return next;
                            });
                            update.reset();
                          }}
                        />
                        <bdi className="min-w-0 [overflow-wrap:anywhere]">
                          {name}
                        </bdi>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : (
              <p className="text-sm text-ink-muted">
                אפשר להוסיף שירותים במסך ״שירותים״.
              </p>
            ))}
        </fieldset>
        <SaveFeedback
          saved={update.isSuccess}
          error={update.error?.message}
          text="שיוך השירותים נשמר."
        />
        <button
          type="submit"
          className="action-primary justify-self-start"
          disabled={update.isPending}
        >
          {update.isPending ? "שומרים…" : "שמירת שירותים"}
        </button>
      </form>
    </section>
  );
}

function HoursSettings({ settings }: { settings: Settings }) {
  const utils = trpc.useUtils();
  const [personal, setPersonal] = useState(settings.weeklyHours !== null);
  const update = trpc.staff.setWeeklyHours.useMutation({
    onSuccess: ({ days }) => {
      utils.staff.getSettings.setData(
        { memberId: settings.id },
        (data) => data && { ...data, weeklyHours: days },
      );
      void utils.public.getAvailableDates.invalidate();
      void utils.public.getAvailableSlots.invalidate();
    },
  });

  return (
    <section aria-labelledby="team-hours" className="grid gap-3">
      <div className={panel}>
        <h2 id="team-hours" className="text-xl font-semibold">
          שעות עבודה
        </h2>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3">
          <input
            type="checkbox"
            checked={personal}
            disabled={update.isPending}
            className={checkbox}
            onChange={(event) => {
              setPersonal(event.target.checked);
              update.reset();
            }}
          />
          <span className="min-w-0">
            <span className="block font-semibold">שעות עבודה אישיות</span>
            <span className="block text-sm text-ink-muted">
              ברירת המחדל היא שעות העסק. אפשר להגדיר שעות והפסקות ליומן הזה.
            </span>
          </span>
        </label>
        {!personal && settings.weeklyHours !== null && (
          <button
            type="button"
            className="action-primary justify-self-start"
            disabled={update.isPending}
            onClick={() => update.mutate({ memberId: settings.id, days: null })}
          >
            {update.isPending ? "שומרים…" : "חזרה לשעות העסק"}
          </button>
        )}
        {!personal && (
          <SaveFeedback
            saved={update.isSuccess}
            error={update.error?.message}
            text="היומן משתמש בשעות העסק."
          />
        )}
      </div>
      {personal && (
        <WeeklyHoursForm
          days={settings.weeklyHours ?? settings.businessWeek}
          onSave={(days) => update.mutate({ memberId: settings.id, days })}
          pending={update.isPending}
          saved={update.isSuccess}
          error={update.error?.message}
        />
      )}
    </section>
  );
}

function SaveFeedback({
  saved,
  error,
  text,
}: {
  saved: boolean;
  error?: string;
  text: string;
}) {
  if (error)
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  if (saved)
    return (
      <p role="status" className="text-sm text-success">
        {text}
      </p>
    );
  return null;
}
