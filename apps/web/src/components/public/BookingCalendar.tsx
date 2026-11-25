const weekdays = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const monthFormatter = new Intl.DateTimeFormat("he-IL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "full",
  timeZone: "UTC",
});

export function formatBookingDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00Z`));
}

export function BookingCalendar({
  month,
  minDate,
  maxDate,
  dates,
  selectedDate,
  loading,
  onMonthChange,
  onSelect,
}: {
  month: string;
  minDate: string;
  maxDate: string;
  dates: string[];
  selectedDate: string | null;
  loading: boolean;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
}) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const year = first.getUTCFullYear();
  const monthIndex = first.getUTCMonth();
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const available = new Set(dates);
  const arrowClass =
    "grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-line text-2xl leading-none text-owner hover:bg-owner-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent";

  function changeMonth(offset: number) {
    onMonthChange(
      new Date(Date.UTC(year, monthIndex + offset, 1))
        .toISOString()
        .slice(0, 7),
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="לחודש הקודם"
          onClick={() => changeMonth(-1)}
          disabled={month <= minDate.slice(0, 7)}
          className={arrowClass}
        >
          <span dir="ltr" aria-hidden="true">
            ›
          </span>
        </button>
        <p
          aria-live="polite"
          className="text-center text-lg font-semibold text-ink"
        >
          {monthFormatter.format(first)}
        </p>
        <button
          type="button"
          aria-label="לחודש הבא"
          onClick={() => changeMonth(1)}
          disabled={month >= maxDate.slice(0, 7)}
          className={arrowClass}
        >
          <span dir="ltr" aria-hidden="true">
            ‹
          </span>
        </button>
      </div>

      <div aria-busy={loading} className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((weekday) => (
          <span
            key={weekday}
            aria-hidden="true"
            className="py-2 text-sm font-medium text-ink-muted"
          >
            {weekday}
          </span>
        ))}
        {Array.from({ length: first.getUTCDay() }, (_, index) => (
          <span key={`empty-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const day = index + 1;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const isAvailable = available.has(date);
          const isToday = date === minDate;
          const isSelected = date === selectedDate && isAvailable;
          return (
            <button
              key={date}
              type="button"
              aria-label={formatBookingDate(date)}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              disabled={!isAvailable}
              onClick={() => onSelect(date)}
              className={`mx-auto min-h-11 w-full max-w-12 rounded-xl border text-sm tabular-nums sm:text-base ${
                isSelected
                  ? "border-owner bg-owner font-bold text-white"
                  : isAvailable
                    ? "cursor-pointer border-line bg-surface font-bold text-ink hover:border-owner hover:text-owner"
                    : "border-transparent text-ink-muted opacity-55"
              } ${isToday && !isSelected ? "border-dashed! border-control!" : ""}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
