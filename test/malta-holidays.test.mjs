/**
 * Tests lib/malta-holidays.js — pure functions, no dependencies, no DB.
 *
 * Run: node test/malta-holidays.test.mjs
 */
import { maltaHolidayName, goodFriday } from "../lib/malta-holidays.js";

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

console.log("— fixed-date holidays, 2026 —");
{
  const cases = [
    ["2026-01-01", "New Year's Day"],
    ["2026-02-10", "Feast of St. Paul's Shipwreck"],
    ["2026-03-19", "Feast of St. Joseph"],
    ["2026-03-31", "Freedom Day"],
    ["2026-05-01", "Worker's Day"],
    ["2026-06-07", "Sette Giugno"],
    ["2026-06-29", "L-Imnarja (Feast of St. Peter and St. Paul)"],
    ["2026-08-15", "Feast of the Assumption"],
    ["2026-09-08", "Feast of Our Lady of Victories"],
    ["2026-09-21", "Independence Day"],
    ["2026-12-08", "Feast of the Immaculate Conception"],
    ["2026-12-13", "Republic Day"],
    ["2026-12-25", "Christmas Day"],
  ];
  for (const [date, name] of cases) {
    ok(maltaHolidayName(date) === name, `${date} -> "${name}"`);
  }
  ok(cases.length === 13, "all 13 fixed-date holidays covered");
}

console.log("\n— Good Friday, computed from Easter —");
{
  // Known real-world Good Friday dates, spanning years with different
  // Easter-calculation edge cases (early March Easter, late April Easter).
  const knownGoodFridays = {
    2024: "2024-03-29",
    2025: "2025-04-18",
    2026: "2026-04-03",
    2027: "2027-03-26",
  };
  for (const [year, expected] of Object.entries(knownGoodFridays)) {
    const computed = goodFriday(Number(year)).toISOString().slice(0, 10);
    ok(computed === expected, `Good Friday ${year}: computed ${computed}, expected ${expected}`);
    ok(maltaHolidayName(expected) === "Good Friday", `maltaHolidayName(${expected}) -> "Good Friday"`);
  }
}

console.log("\n— ordinary days —");
{
  ok(maltaHolidayName("2026-07-01") === null, "2026-07-01 (ordinary day) -> null");
  ok(maltaHolidayName("2026-04-02") === null, "day before 2026 Good Friday -> null");
  ok(maltaHolidayName("2026-04-04") === null, "day after 2026 Good Friday -> null");
  ok(maltaHolidayName("2026-12-24") === null, "Christmas Eve is not itself a listed holiday -> null");
}

console.log("\n— the 14th holiday: Good Friday stays inside its known range —");
{
  // Good Friday (Gregorian) can only fall between 20 March and 23 April.
  // Confirms the Meeus/Jones/Butcher computation isn't drifting out of
  // range for any year in this span, not just the four pinned above.
  const FIXED_DATES = new Set(Object.keys({
    "01-01": 1, "02-10": 1, "03-19": 1, "03-31": 1, "05-01": 1, "06-07": 1, "06-29": 1,
    "08-15": 1, "09-08": 1, "09-21": 1, "12-08": 1, "12-13": 1, "12-25": 1,
  }));
  let allInRange = true;
  let noCollision = true;
  for (let year = 2020; year <= 2040; year++) {
    const iso = goodFriday(year).toISOString().slice(0, 10);
    const md = iso.slice(5);
    if (md < "03-20" || md > "04-23") allInRange = false;
    if (FIXED_DATES.has(md)) noCollision = false;
  }
  ok(allInRange, "Good Friday 2020-2040 always falls within 20 Mar - 23 Apr");
  ok(noCollision, "Good Friday 2020-2040 never lands on one of the 13 fixed dates");
}

console.log(`\n${failures === 0 ? "ALL MALTA HOLIDAY CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
process.exit(failures === 0 ? 0 : 1);
