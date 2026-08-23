/**
 * Tests lib/proactive.js's scheduling logic — the catch-up window, the
 * generation-failure alert, and the Malta holiday gate — against mock
 * send/ask/alertAdmin functions. No DB, no network: dbAvailable() is false
 * without DATABASE_URL, so once() falls back to its in-memory dedupe Set,
 * same as every other offline suite in this repo.
 *
 * Run: node test/proactive.test.mjs
 */
import { inCatchupWindow, maltaClock, startProactive } from "../lib/proactive.js";

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

// ─── inCatchupWindow(): pure boundary checks ────────────────────────────────
console.log("— inCatchupWindow(): pure boundary checks —");
{
  ok(inCatchupWindow(7, 7, 4) === true, "hour === target -> in window");
  ok(inCatchupWindow(9, 7, 4) === true, "hour = target + 2 -> in window (this is the whole point: a missed 7am tick catches up at 9am)");
  ok(inCatchupWindow(10, 7, 4) === true, "hour = target + 3 -> still in window");
  ok(inCatchupWindow(11, 7, 4) === false, "hour = target + 4 -> window is exclusive at the top edge");
  ok(inCatchupWindow(6, 7, 4) === false, "hour before target -> not yet due");
  ok(inCatchupWindow(0, 7, 4) === false, "midnight, target 7am -> not in window");
}

// Helper: build a Date whose Malta local time matches what we want, using
// maltaClock() itself to confirm rather than hand-computing the UTC offset.
function maltaDate(y, m, d, hh) {
  // Malta is UTC+1 (CET) or UTC+2 (CEST). Start from a UTC guess and adjust
  // until maltaClock() reports the target local hour and date — avoids
  // hand-coding the DST rule here.
  for (let utcHour = hh - 2; utcHour <= hh + 1; utcHour++) {
    const candidate = new Date(Date.UTC(y, m - 1, d, ((utcHour % 24) + 24) % 24, 0, 0));
    const clock = maltaClock(candidate);
    if (clock.hour === hh && clock.dateIso === `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`) {
      return candidate;
    }
  }
  throw new Error(`could not construct a UTC instant for Malta local ${y}-${m}-${d} ${hh}:00`);
}

function mockAsk({ fail = 0, reply = "mock briefing text" } = {}) {
  const calls = [];
  let failuresLeft = fail;
  return {
    calls,
    fn: async (instruction, digest) => {
      calls.push({ instruction, digest });
      if (failuresLeft > 0) { failuresLeft--; return null; }
      return reply;
    },
  };
}

function mockSink() {
  const calls = [];
  return { calls, fn: async (...args) => { calls.push(args); } };
}

// ─── Catch-up: a missed 07:00 tick still fires once at 09:00 ───────────────
console.log("\n— catch-up: missed 07:00 window fires at 09:00, then never again same day —");
{
  const send = mockSink();
  const ask = mockAsk({ reply: "Good morning, Beverly." });
  const alertAdmin = mockSink();
  const p = startProactive({
    send: send.fn, ask: ask.fn, getCalendar: null, alertAdmin: alertAdmin.fn,
    config: { retryDelayMs: 5 },
  });

  const nineAm = maltaDate(2026, 7, 20, 9); // a Monday, ordinary (non-holiday) day
  await p.tick(nineAm);
  ok(send.calls.length === 1, "first tick at 09:00 (7am window missed) sends the morning briefing");

  const tenAm = maltaDate(2026, 7, 20, 10);
  await p.tick(tenAm);
  ok(send.calls.length === 1, "a second tick later the same day does not re-send (once() dedupe still holds)");
  p.stop();
}

// ─── Outside the catch-up window: no fire ───────────────────────────────────
console.log("\n— outside the catch-up window: does not fire —");
{
  const send = mockSink();
  const ask = mockAsk();
  const p = startProactive({ send: send.fn, ask: ask.fn, getCalendar: null, config: { retryDelayMs: 5 } });

  const noon = maltaDate(2026, 7, 21, 12); // well past morningHour(7) + catchupHours(4)
  await p.tick(noon);
  ok(send.calls.length === 0, "a tick at noon (past the 4h catch-up window) does not send the morning briefing");
  p.stop();
}

// ─── Retry: first ask() call fails, second succeeds -> still sends, no alert ─
console.log("\n— retry: one failed ask() attempt, then success —");
{
  const send = mockSink();
  const ask = mockAsk({ fail: 1, reply: "Good morning, Beverly — recovered on retry." });
  const alertAdmin = mockSink();
  const p = startProactive({
    send: send.fn, ask: ask.fn, getCalendar: null, alertAdmin: alertAdmin.fn,
    config: { retryDelayMs: 5 },
  });

  const nineAm = maltaDate(2026, 7, 22, 9);
  await p.tick(nineAm);
  ok(ask.calls.length === 2, "ask() was called twice — one failure, one retry");
  ok(send.calls.length === 1, "the briefing still sends after the retry succeeds");
  ok(alertAdmin.calls.length === 0, "no admin alert fired — the retry recovered it");
  p.stop();
}

// ─── Sustained failure: both attempts fail -> admin alerted, nothing sent ──
console.log("\n— sustained failure: both attempts fail -> alertAdmin, no send —");
{
  const send = mockSink();
  const ask = mockAsk({ fail: 99 }); // always fails
  const alertAdmin = mockSink();
  const p = startProactive({
    send: send.fn, ask: ask.fn, getCalendar: null, alertAdmin: alertAdmin.fn,
    config: { retryDelayMs: 5 },
  });

  const nineAm = maltaDate(2026, 7, 23, 9);
  await p.tick(nineAm);
  ok(ask.calls.length === 2, "ask() retried once before giving up");
  ok(send.calls.length === 0, "nothing was sent to Beverly — a failed generation must never send garbage");
  ok(alertAdmin.calls.length === 1, "alertAdmin was called exactly once");
  const [, opts] = alertAdmin.calls[0];
  ok(opts?.title === "Sam: morning briefing generation failed", `alert title identifies the failure: "${opts?.title}"`);
  p.stop();
}

// ─── Malta holiday gate: greeting instead of a briefing ────────────────────
console.log("\n— holiday gate: sends a greeting, not the normal briefing —");
{
  const send = mockSink();
  const ask = mockAsk({ reply: "Happy Feast of the Assumption, Beverly!" });
  const alertAdmin = mockSink();
  const p = startProactive({
    send: send.fn, ask: ask.fn, getCalendar: null, alertAdmin: alertAdmin.fn,
    config: { retryDelayMs: 5 },
  });

  const holidayMorning = maltaDate(2026, 8, 15, 9); // Feast of the Assumption
  await p.tick(holidayMorning);
  ok(send.calls.length === 1, "sends exactly one message on a holiday morning");
  ok(/PROACTIVE HOLIDAY GREETING/.test(ask.calls[0].instruction), "ask() was given the holiday-greeting instruction, not the normal briefing one");
  ok(/Feast of the Assumption/.test(ask.calls[0].instruction), "the instruction names the actual holiday");
  ok(alertAdmin.calls.length === 0, "no admin alert on a normal holiday send");
  p.stop();
}

// ─── Holiday gate, Claude fails: canned fallback used, no admin alert ───────
console.log("\n— holiday gate: Claude fails -> canned fallback sent, no alert —");
{
  const send = mockSink();
  const ask = mockAsk({ fail: 99 });
  const alertAdmin = mockSink();
  const p = startProactive({
    send: send.fn, ask: ask.fn, getCalendar: null, alertAdmin: alertAdmin.fn,
    config: { retryDelayMs: 5 },
  });

  const holidayMorning = maltaDate(2026, 9, 8, 9); // Feast of Our Lady of Victories
  await p.tick(holidayMorning);
  ok(send.calls.length === 1, "still sends something — the canned fallback — even though ask() failed both attempts");
  const [sentText] = send.calls[0];
  ok(/Feast of Our Lady of Victories/.test(sentText), `the canned fallback names the actual holiday: "${sentText}"`);
  ok(alertAdmin.calls.length === 0, "a holiday-greeting failure never alerts admin — low stakes, always has a fallback");
  p.stop();
}

console.log(`\n${failures === 0 ? "ALL PROACTIVE SCHEDULER CHECKS PASSED" : `*** ${failures} CHECK(S) FAILED ***`}`);
process.exit(failures === 0 ? 0 : 1);
