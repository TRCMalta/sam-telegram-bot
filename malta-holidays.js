/**
 * malta-holidays.js — Malta national public holidays (14/year)
 *
 * 13 are fixed-date; Good Friday is movable and is COMPUTED from Easter rather
 * than hardcoded, so this module stays correct year after year with no edits.
 *
 * Pure and dependency-free (matches the codebase — Node 18+, ESM). The input is
 * a Malta wall-clock Date; month/day/year are read in local components, so the
 * caller is responsible for passing a Date that represents the Malta calendar
 * day (see the morning-briefing gate in server.js).
 *
 * Used by Sam's 07:00 morning gate to (a) skip Beverly's normal briefing on a
 * public holiday and (b) send a warm greeting instead.
 */

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher). Returns {month, day}
// (1-based month) for Easter Sunday in the given year.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// Good Friday is the Friday before Easter Sunday → Easter minus 2 days.
// Computed via UTC arithmetic to dodge any DST/timezone edge at the boundary.
export function goodFriday(year) {
  const easter = easterSunday(year);
  const dt = new Date(Date.UTC(year, easter.month - 1, easter.day));
  dt.setUTCDate(dt.getUTCDate() - 2);
  return { month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

// 13 fixed-date national public holidays, keyed "M-D" (no leading zeros).
const FIXED = {
  "1-1":   "New Year's Day",
  "2-10":  "Feast of St Paul's Shipwreck",
  "3-19":  "Feast of St Joseph",
  "3-31":  "Freedom Day (Jum il-Ħelsien)",
  "5-1":   "Workers' Day",
  "6-7":   "Sette Giugno",
  "6-29":  "L-Imnarja (Feast of St Peter & St Paul)",
  "8-15":  "Feast of the Assumption (Santa Marija)",
  "9-8":   "Victory Day (Jum il-Vitorja)",
  "9-21":  "Independence Day (Jum l-Indipendenza)",
  "12-8":  "Feast of the Immaculate Conception",
  "12-13": "Republic Day (Jum ir-Repubblika)",
  "12-25": "Christmas Day",
};

/**
 * Returns the holiday name (string) when `date` falls on a Malta national
 * public holiday, otherwise null. Pass a Malta wall-clock Date.
 */
export function maltaPublicHoliday(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  const fixed = FIXED[`${month}-${day}`];
  if (fixed) return fixed;

  const gf = goodFriday(year);
  if (month === gf.month && day === gf.day) return "Good Friday";

  return null;
}
