/**
 * Unit tests for malta-holidays.js
 *
 * Pins the 14-holiday Malta calendar and the computed Good Friday date so a
 * future edit can't silently drop a holiday or break the Easter math. Sam's
 * 07:00 morning gate relies on this returning a non-null name on exactly those
 * 14 days and null on every other day.
 *
 * Run with:  node --test tests/malta-holidays.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { maltaPublicHoliday, goodFriday } from "../malta-holidays.js";

const d = (y, m, day) => new Date(y, m - 1, day);

test("returns all 14 Malta public holidays for 2026", () => {
  let count = 0;
  for (let m = 0; m < 12; m++) {
    for (let day = 1; day <= 31; day++) {
      const dt = new Date(2026, m, day);
      if (dt.getMonth() !== m) continue;
      if (maltaPublicHoliday(dt)) count++;
    }
  }
  assert.equal(count, 14, `expected 14 holidays, got ${count}`);
});

test("Good Friday 2026 is computed as 3 April", () => {
  assert.deepEqual(goodFriday(2026), { month: 4, day: 3 });
  assert.equal(maltaPublicHoliday(d(2026, 4, 3)), "Good Friday");
});

test("Good Friday tracks Easter across years (spot checks)", () => {
  assert.deepEqual(goodFriday(2024), { month: 3, day: 29 });
  assert.deepEqual(goodFriday(2025), { month: 4, day: 18 });
  assert.deepEqual(goodFriday(2027), { month: 3, day: 26 });
});

test("L-Imnarja (29 June) is recognised", () => {
  assert.equal(
    maltaPublicHoliday(d(2026, 6, 29)),
    "L-Imnarja (Feast of St Peter & St Paul)"
  );
});

test("an ordinary working day returns null", () => {
  assert.equal(maltaPublicHoliday(d(2026, 6, 30)), null);
  assert.equal(maltaPublicHoliday(d(2026, 7, 1)), null);
});
