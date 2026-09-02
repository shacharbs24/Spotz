import type { AppointmentStatus } from "../schemas/appointment";

const OWNER_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> =
  {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["COMPLETED", "CANCELLED"],
    CANCELLED: [],
    COMPLETED: [],
  };

/**
 * Owner transitions are intentionally one-way. Re-applying the current status
 * is allowed so retrying an idempotent request does not fail.
 */
export function canOwnerSetAppointmentStatus(
  current: AppointmentStatus,
  next: AppointmentStatus,
): boolean {
  return current === next || OWNER_STATUS_TRANSITIONS[current].includes(next);
}
