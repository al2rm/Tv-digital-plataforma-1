import test from "node:test";
import assert from "node:assert/strict";
import {
  dateInputInTimeZone,
  formatDateOnly
} from "../../admin/src/utils/date.js";

test("usa el día comercial de Paraguay y no el día UTC", () => {
  const lateEveningInParaguay = new Date("2026-10-05T00:30:00.000Z");
  assert.equal(dateInputInTimeZone(lateEveningInParaguay), "2026-10-04");
});

test("presenta fechas DATE sin desplazarlas por zona horaria", () => {
  assert.equal(formatDateOnly("2026-10-04T00:00:00.000Z"), "04/10/2026");
  assert.equal(formatDateOnly(""), "-");
});
