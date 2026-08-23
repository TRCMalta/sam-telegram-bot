/**
 * lib/malta-holidays.js — Malta's public holiday calendar.
 *
 * Pure, dependency-free, no network. 13 fixed-date holidays plus Good Friday,
 * computed from Easter (Meeus/Jones/Butcher algorithm) so it stays correct
 * every year without an annual edit.
 *
 * Used to gate Sam's 07:00 morning briefing: on a public holiday there's no
 * pipeline, no calendar, no open items worth chasing — Beverly gets a short
 * greeting instead. See lib/proactive.js.
 */

// MM-DD -> holiday name. Malta observes 13 fixed-date public holidays;
// Good Friday is the 14th and is computed, not listed here.
const FIXED_HOLIDAYS = {
  "01-01": "New Year's Day",
  "02-10": "Feast of St. Paul's Shipwreck",
  "03-19": "Feast of St. Joseph",
  "03-31": "Freedom Day",
  "05-01": "Worker's Day",
  "06-07": "Sette Giugno",
  "06-29": "L-Imnarja (Feast of St. Peter and St. Paul)",
  "08-15": "Feast of the Assumption",
  "09-08": "Feast of Our Lady of Victories",
  "09-21": "Independence Day",
  "12-08": "Feast of the Immaculate Conception",
  "12-13": "Republic Day",
  "12-25": "Christmas Day",
};

/**
 * Easter Sunday (Gregorian), Meeus/Jones/Butcher algorithm. Returns a UTC
 * Date at midnight — this is a calendar computation, not a moment in time,
 * so UTC is used purely to avoid local-timezone drift on the date itself.
 */
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
  const monthDay = h + l - 7 * m + 114;
  const month = Math.floor(monthDay / 31); // 3 = March, 4 = April
  const day = (monthDay % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(d) {
  return d.toISOString().slice(0, 10);
}

/** Good Friday: two days before Easter Sunday. */
export function goodFriday(year) {
  const gf = easterSunday(year);
  gf.setUTCDate(gf.getUTCDate() - 2);
  return gf;
}

/**
 * @param dateIso "YYYY-MM-DD" (Malta local calendar date — see maltaClock() in
 *                lib/proactive.js, which is what callers pass in)
 * @returns the holiday name, or null if `dateIso` is an ordinary day.
 */
export function maltaHolidayName(dateIso) {
  const md = dateIso.slice(5); // "MM-DD"
  if (FIXED_HOLIDAYS[md]) return FIXED_HOLIDAYS[md];
  const year = Number(dateIso.slice(0, 4));
  if (toIso(goodFriday(year)) === dateIso) return "Good Friday";
  return null;
}
