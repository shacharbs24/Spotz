"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { useDebounce } from "@/hooks/useDebounce";
import { formatPrice } from "@/lib/format";
import { STATUS_META } from "@/components/dashboard/appointments/AgendaRow";
import type { AppointmentHistoryRow } from "@/trpc/types";

const SEARCH_DEBOUNCE_MS = 400;

export function HistoryList() {
  const [search, setSearch] = useState("");
  // Debounce so typing doesn't fire a query per keystroke.
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);

  const historyQuery = trpc.appointments.getAppointmentHistory.useInfiniteQuery(
    { searchQuery: debouncedSearch.trim() || undefined },
    { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
  );

  const items = historyQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const isSearching = search !== debouncedSearch;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="client-search" className="text-sm font-medium text-ink">
          חיפוש לפי שם לקוח
        </label>
        <div className="relative">
          <input
            id="client-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="הקלידו שם לקוח…"
            className="w-full rounded-xl border border-line bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-owner"
          />
          {isSearching && (
            <span className="absolute inset-y-0 left-3 flex items-center text-xs text-ink-muted">
              מחפש…
            </span>
          )}
        </div>
      </div>

      {historyQuery.isLoading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-14 text-center text-ink-muted">
          {debouncedSearch.trim()
            ? "לא נמצאו תורים עבור החיפוש."
            : "אין עדיין היסטוריית תורים."}
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((appointment) => (
            <HistoryRow key={appointment.id} appointment={appointment} />
          ))}
        </ol>
      )}

      {historyQuery.hasNextPage && (
        <button
          type="button"
          onClick={() => historyQuery.fetchNextPage()}
          disabled={historyQuery.isFetchingNextPage}
          className="mx-auto cursor-pointer rounded-full border border-line px-5 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-owner/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {historyQuery.isFetchingNextPage ? "טוען…" : "טען עוד"}
        </button>
      )}
    </div>
  );
}

function HistoryRow({ appointment }: { appointment: AppointmentHistoryRow }) {
  const meta = STATUS_META[appointment.status];

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight text-ink">
            {appointment.clientName}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
          >
            {meta.label}
          </span>
        </div>
        <span className="text-sm text-ink-muted">{appointment.serviceName}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span>{appointment.date}</span>
          <span dir="ltr">
            {appointment.startTime}–{appointment.endTime}
          </span>
          <a
            href={`tel:${appointment.clientPhone}`}
            dir="ltr"
            className="transition-colors hover:text-ink"
          >
            {appointment.clientPhone}
          </a>
          <span className="font-medium text-owner">
            {formatPrice(appointment.priceCentsSnapshot)}
          </span>
        </div>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-line" />
          <div className="h-4 w-56 animate-pulse rounded bg-line" />
        </div>
      ))}
    </div>
  );
}
