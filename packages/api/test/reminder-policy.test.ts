import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConfirmationUrl,
  getNextReminderRetryAt,
  getReminderWindowEnd,
  isReminderRetryEligible,
  normalizeAppBaseUrl,
} from "../src/services/reminder-policy";

const now = new Date("2026-08-24T08:00:00.000Z");

test("accepts only absolute HTTP(S) application URLs", () => {
  assert.equal(
    normalizeAppBaseUrl(" https://spotz.example/// "),
    "https://spotz.example",
  );
  assert.equal(
    normalizeAppBaseUrl("http://localhost:3000/"),
    "http://localhost:3000",
  );
  assert.throws(() => normalizeAppBaseUrl(undefined), /absolute http\(s\) URL/);
  assert.throws(
    () => normalizeAppBaseUrl("/relative"),
    /absolute http\(s\) URL/,
  );
  assert.throws(
    () => normalizeAppBaseUrl("ftp://example.com"),
    /absolute http\(s\) URL/,
  );
});

test("builds a tokenized confirmation link safely", () => {
  assert.equal(
    buildConfirmationUrl("https://spotz.example", "appointment id", "a+b/c="),
    "https://spotz.example/b/confirm/appointment%20id?token=a%2Bb%2Fc%3D",
  );
});

test("uses a precise 24-hour reminder window", () => {
  assert.equal(
    getReminderWindowEnd(now).toISOString(),
    "2026-08-25T08:00:00.000Z",
  );
});

test("retries only due failures below the attempt limit", () => {
  assert.equal(
    isReminderRetryEligible(
      { status: "FAILED", attemptCount: 2, nextAttemptAt: new Date(now) },
      now,
    ),
    true,
  );
  assert.equal(
    isReminderRetryEligible(
      {
        status: "FAILED",
        attemptCount: 2,
        nextAttemptAt: new Date(now.getTime() + 1),
      },
      now,
    ),
    false,
  );
  assert.equal(
    isReminderRetryEligible(
      { status: "FAILED", attemptCount: 3, nextAttemptAt: null },
      now,
    ),
    false,
  );
  assert.equal(
    isReminderRetryEligible(
      { status: "SENT", attemptCount: 1, nextAttemptAt: null },
      now,
    ),
    false,
  );
});

test("schedules one-hour retries and stops at the limit", () => {
  assert.equal(
    getNextReminderRetryAt(now, 2)?.toISOString(),
    "2026-08-24T09:00:00.000Z",
  );
  assert.equal(getNextReminderRetryAt(now, 3), null);
});
