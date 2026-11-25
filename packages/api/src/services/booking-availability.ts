import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, tables } from "@spotz/db";

/** Read the shared business hours and blocks, and bookings for one calendar. */
export async function loadBookingSchedule(
  businessId: string,
  staffMemberId: string | undefined,
  start: DateTime,
  end: DateTime,
) {
  const { appointments, blockedPeriods, workingHours } = tables;
  const startAt = start.toJSDate();
  const endAt = end.toJSDate();
  const [week, booked, blocked] = await Promise.all([
    db
      .select()
      .from(workingHours)
      .where(eq(workingHours.businessId, businessId)),
    db
      .select({ startAt: appointments.startAt, endAt: appointments.endAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, businessId),
          staffMemberId
            ? eq(appointments.staffMemberId, staffMemberId)
            : isNull(appointments.staffMemberId),
          ne(appointments.status, "CANCELLED"),
          lt(appointments.startAt, endAt),
          gt(appointments.endAt, startAt),
        ),
      ),
    db
      .select({ startAt: blockedPeriods.startAt, endAt: blockedPeriods.endAt })
      .from(blockedPeriods)
      .where(
        and(
          eq(blockedPeriods.businessId, businessId),
          lt(blockedPeriods.startAt, endAt),
          gt(blockedPeriods.endAt, startAt),
        ),
      ),
  ]);

  return {
    hoursByDay: new Map(week.map((hours) => [hours.dayOfWeek, hours])),
    busy: [...booked, ...blocked].map(({ startAt, endAt }) => ({
      start: DateTime.fromJSDate(startAt),
      end: DateTime.fromJSDate(endAt),
    })),
  };
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function slotsForDay(
  dayStart: DateTime,
  durationMinutes: number,
  schedule: Awaited<ReturnType<typeof loadBookingSchedule>>,
  now: DateTime,
) {
  // Luxon Monday=1…Sunday=7, schema Sunday=0…Saturday=6.
  const hours = schedule.hoursByDay.get(dayStart.weekday % 7);
  if (!hours || hours.isClosed || durationMinutes <= 0) return [];

  const dayEnd = dayStart.plus({ days: 1 });
  const busy: { start: DateTime; end: DateTime }[] = schedule.busy.filter(
    (interval) => interval.start < dayEnd && dayStart < interval.end,
  );
  for (const pause of hours.breaks) {
    busy.push({
      start: dayStart.plus({ minutes: timeToMinutes(pause.start) }),
      end: dayStart.plus({ minutes: timeToMinutes(pause.end) }),
    });
  }

  const slots: string[] = [];
  const endMinutes = timeToMinutes(hours.endTime);
  for (
    let minute = timeToMinutes(hours.startTime);
    minute + durationMinutes <= endMinutes;
    minute += durationMinutes
  ) {
    const start = dayStart.plus({ minutes: minute });
    const end = start.plus({ minutes: durationMinutes });
    if (
      start < now ||
      busy.some((interval) => start < interval.end && interval.start < end)
    )
      continue;
    slots.push(start.toFormat("HH:mm"));
  }
  return slots;
}
