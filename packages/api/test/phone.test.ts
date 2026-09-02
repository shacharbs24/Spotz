import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIsraeliPhone } from "../src/lib/phone";

test("normalizes common Israeli phone formats", () => {
  assert.equal(normalizeIsraeliPhone("050-123-4567"), "972501234567");
  assert.equal(normalizeIsraeliPhone("+972 50 123 4567"), "972501234567");
  assert.equal(normalizeIsraeliPhone("00972-50-123-4567"), "972501234567");
  assert.equal(normalizeIsraeliPhone("50 123 4567"), "972501234567");
});

test("rejects missing and malformed phone numbers", () => {
  assert.equal(normalizeIsraeliPhone(null), null);
  assert.equal(normalizeIsraeliPhone(""), null);
  assert.equal(normalizeIsraeliPhone("123"), null);
  assert.equal(normalizeIsraeliPhone("+1 212 555 0123"), null);
});
