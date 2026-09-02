import assert from "node:assert/strict";
import test from "node:test";
import { canOwnerSetAppointmentStatus } from "../src/domain/appointment-status";
import type { AppointmentStatus } from "../src/schemas/appointment";

const statuses: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
];

const allowed = new Set([
  "PENDING:PENDING",
  "PENDING:CONFIRMED",
  "PENDING:CANCELLED",
  "CONFIRMED:CONFIRMED",
  "CONFIRMED:COMPLETED",
  "CONFIRMED:CANCELLED",
  "CANCELLED:CANCELLED",
  "COMPLETED:COMPLETED",
]);

test("owner appointment status matrix stays one-way and idempotent", () => {
  for (const current of statuses) {
    for (const next of statuses) {
      assert.equal(
        canOwnerSetAppointmentStatus(current, next),
        allowed.has(`${current}:${next}`),
        `${current} -> ${next}`,
      );
    }
  }
});
