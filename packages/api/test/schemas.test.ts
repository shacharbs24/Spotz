import assert from "node:assert/strict";
import test from "node:test";
import { createAppointmentSchema } from "../src/schemas/booking";
import { businessInputSchema } from "../src/schemas/business";

const validBusiness = {
  name: "מספרה",
  slug: "my-barbershop",
  timezone: "Asia/Jerusalem",
  autoOpenCalendar: true,
  autoOpenDays: 30,
  manualOpenUntil: "",
};

test("business input normalizes slugs and rejects inline images", () => {
  assert.equal(
    businessInputSchema.parse({ ...validBusiness, slug: "My-Shop" }).slug,
    "my-shop",
  );
  assert.equal(
    businessInputSchema.safeParse({
      ...validBusiness,
      imageUrl: "data:image/png;base64,AAAA",
    }).success,
    false,
  );
});

test("manual booking windows require an end date", () => {
  assert.equal(
    businessInputSchema.safeParse({
      ...validBusiness,
      autoOpenCalendar: false,
    }).success,
    false,
  );
  assert.equal(
    businessInputSchema.safeParse({
      ...validBusiness,
      autoOpenCalendar: false,
      manualOpenUntil: "2026-12-31",
    }).success,
    true,
  );
});

test("appointment input enforces UUIDs and 24-hour times", () => {
  const valid = {
    businessId: "11111111-1111-4111-8111-111111111111",
    serviceId: "22222222-2222-4222-8222-222222222222",
    date: "2026-08-24",
    time: "23:59",
  };
  assert.equal(createAppointmentSchema.safeParse(valid).success, true);
  assert.equal(
    createAppointmentSchema.safeParse({ ...valid, time: "24:00" }).success,
    false,
  );
  assert.equal(
    createAppointmentSchema.safeParse({ ...valid, businessId: "not-a-uuid" })
      .success,
    false,
  );
});
