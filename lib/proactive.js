/**
 * lib/proactive.js — the things Sam says without being asked.
 *
 * Sam had exactly one proactive moment: a 07:00 greeting whose only state was
 * a file in /tmp that Railway wiped on redeploy. This adds the rest of the
 * chief-of-staff cadence and moves dedupe into Postgres so a deploy no longer
 * causes a double-send or a silent miss.
 *
 * Design notes:
 *   - Each digest is assembled deterministically in code, then handed to
 *     Claude once to be written in Sam's voice. No LLM does the counting.
 *   - Every behaviour is dedupe-keyed in the kv table, so a restart mid-window
 *     cannot re-fire it.
 *   - Nothing here throws. A failing briefing must never take Sam's webhook
 *     down; the whole tick is wrapped.
 *
 * Wired as a factory rather than importing from server.js, to avoid a circular
 * import between the two.
 */
import { kvGet, kvSet, dbAvailable } from "./db.js";
import { dueSoon, staleRelationships, markChased, markRelationshipsAlerted, listItems } from "./openitems.js";
import { valuePortfolio, checkWatchlistAlerts, tradingDiscipline } from "./finance.js";
import { marketEnabled } from "./market.js";
import { maltaHolidayName } from "./malta-holidays.js";

const TZ = "Europe/Malta";

export function maltaClock(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    dateIso: `${p.year}-${p.month}-${p.day}`,
    hour: parseInt(p.hour, 10),
    minute: parseInt(p.minute, 10),
    weekday: p.weekday,           // Mon, Tue, ...
  };
}

/**
 * Fire `fn` at most once per dedupe key.
 *
 * Marks the key BEFORE running, so a crash mid-send does not cause a repeat on
 * restart. A missed briefing is a much smaller failure than a duplicate one at
 * 07:00.
 */
async function once(key, fn) {
  if (dbAvailable()) {
    const seen = await kvGet(`proactive:${key}`);
    if (seen) return false;
    await kvSet(`proactive:${key}`, { at: new Date().toISOString() });
  } else {
    // No database — fall back to process memory. A redeploy may repeat, which
    // is the pre-existing behaviour rather than a regression.
    if (memoryFired.has(key)) return false;
    memoryFired.add(key);
  }
  try {
    await fn();
  } catch (err) {
    console.error(`[PROACTIVE] ${key} failed: ${err.message}`);
  }
  return true;
}
const memoryFired = new Set();

/**
 * True if `hour` falls within [target, target + catchupHours) of the same
 * day. Widens each once-a-day schedule from a single 60-second tick to a
 * multi-hour window so a missed 07:00 tick — a restart, a stalled event
 * loop, a redeploy landing at exactly the wrong minute — self-heals on the
 * next tick that runs, rather than silently skipping the whole day. `once()`
 * still guarantees exactly one fire per key, so widening this window cannot
 * cause a duplicate send; it can only rescue a miss.
 *
 * Exported for tests: pure function, no wall clock involved.
 */
export function inCatchupWindow(hour, targetHour, catchupHours) {
  return hour >= targetHour && hour < targetHour + catchupHours;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call `ask()`, retrying once after a short delay if it comes back empty —
 * a scheduled digest is worth a second attempt against a rate limit or a
 * transient network blip before giving up. `ask()` already catches its own
 * errors and returns null/empty rather than throwing (see askSamToWrite in
 * server.js), so "falsy" is the only failure signal this needs to handle.
 */
async function askWithRetry(ask, instruction, digest, { attempts = 2, delayMs = 5000 } = {}) {
  let text = null;
  for (let i = 0; i < attempts && !text; i++) {
    if (i > 0) await sleep(delayMs);
    text = await ask(instruction, digest);
  }
  return text;
}

/**
 * A scheduled digest had something to say but Claude never produced usable
 * text for it, even after a retry. Previously this was indistinguishable
 * from "nothing to report" — Beverly and everyone else just never knew. If
 * an admin alert path was wired in (Gordon, ADMIN_TELEGRAM_CHAT_IDS), use
 * it; otherwise this is still no worse than before.
 */
async function reportGenerationFailure(alertAdmin, kind) {
  if (!alertAdmin) return;
  try {
    await alertAdmin(
      `*Sam: ${kind} generation failed*\n\nClaude didn't return usable text after a retry — nothing was sent `
      + `to Beverly for this ${kind}. Check the Claude API (rate limit, outage, bad key) and consider sending `
      + "it by hand.",
      { title: `Sam: ${kind} generation failed`, severity: "warning" },
    );
  } catch (err) {
    console.error(`[PROACTIVE] alertAdmin failed: ${err.message}`);
  }
}

// ─── Digest builders (deterministic — no model involved) ─────────────────────

async function buildMorningDigest({ getCalendar }) {
  const parts = [];

  const events = getCalendar ? await getCalendar(1).catch(() => null) : null;
  if (events && events.length) {
    parts.push(`TODAY'S CALENDAR (${events.length}):`);
    for (const e of events.slice(0, 6)) {
      parts.push(`- ${e.time || ""} ${e.subject}${e.attendees ? ` (with ${e.attendees})` : ""}`);
    }
  } else if (events) {
    parts.push("TODAY'S CALENDAR: nothing scheduled.");
  }

  const due = await dueSoon({ withinDays: 2 });
  if (due.length) {
    parts.push(`\nOPEN ITEMS DUE (${due.length}):`);
    for (const i of due.slice(0, 6)) {
      const overdue = i.due_date && new Date(i.due_date) < new Date(new Date().toDateString());
      parts.push(`- ${i.title}${i.counterparty ? ` [${i.counterparty}]` : ""}${overdue ? " — OVERDUE" : ""}`);
    }
  }

  return parts.join("\n");
}

async function buildWeeklyDigest() {
  const parts = [];

  const open = await listItems({ status: "open", limit: 100 });
  const closedThisWeek = await listItems({ status: "done", limit: 100 });
  const recentlyClosed = closedThisWeek.filter(
    (i) => i.closed_at && new Date(i.closed_at) > Date.now() - 7 * 86_400_000,
  );
  parts.push(`OPEN ITEMS: ${open.length} open, ${recentlyClosed.length} closed this week.`);
  const overdue = open.filter((i) => i.due_date && new Date(i.due_date) < new Date());
  if (overdue.length) {
    parts.push(`OVERDUE (${overdue.length}):`);
    for (const i of overdue.slice(0, 5)) parts.push(`- ${i.title}${i.counterparty ? ` [${i.counterparty}]` : ""}`);
  }

  const stale = await staleRelationships();
  if (stale.length) {
    parts.push(`\nGONE QUIET: ${stale.slice(0, 5).map((s) => `${s.name} (${s.days_since}d)`).join(", ")}`);
  }

  return parts.join("\n");
}

async function buildFinanceDigest() {
  if (!marketEnabled()) return "";
  const parts = [];

  const valued = await valuePortfolio().catch(() => null);
  if (valued && valued.total > 0) {
    const pct = valued.unrealisedPct;
    parts.push(
      `PORTFOLIO: ${valued.currency} ${Math.round(valued.total).toLocaleString("en-GB")}`
      + (pct !== null ? `, ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% against cost` : ""),
    );
    if (valued.problems.length) parts.push(`(couldn't price: ${valued.problems.slice(0, 3).join("; ")})`);
  }

  const disc = await tradingDiscipline({ days: 30 }).catch(() => null);
  if (disc && disc.enoughData && disc.flags.length) {
    parts.push("TRADING PATTERNS WORTH RAISING:");
    for (const f of disc.flags.filter((f) => f.severity !== "low")) parts.push(`- ${f.detail}`);
  }

  return parts.join("\n");
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

/**
 * @param send        (text) => Promise   — deliver a message to Beverly
 * @param sendVoice   (text) => Promise   — optional voice note
 * @param ask         (instruction, digest) => Promise<string> — Claude in Sam's voice
 * @param getCalendar (daysAhead) => Promise<[{time,subject,attendees}]>
 * @param alertAdmin  (text, opts) => Promise — optional. Called when a scheduled digest had
 *                    something to say but Claude failed to write it, even after a retry.
 * @param config      { morningHour, weeklyDay, weeklyHour, chaseHour, staleDay, staleHour, catchupHours }
 */
export function startProactive({ send, sendVoice, ask, getCalendar, alertAdmin, config = {} }) {
  const cfg = {
    morningHour: Number(process.env.MORNING_HOUR_MALTA || 7),
    weeklyDay: process.env.WEEKLY_DEBRIEF_DAY || "Fri",
    weeklyHour: Number(process.env.WEEKLY_DEBRIEF_HOUR || 16),
    chaseHour: Number(process.env.CHASE_HOUR || 12),
    staleDay: process.env.STALE_DAY || "Mon",
    staleHour: Number(process.env.STALE_HOUR || 9),
    meetingPrepMins: Number(process.env.MEETING_PREP_MINS || 30),
    watchlistEnabled: (process.env.WATCHLIST_ALERTS || "on") !== "off",
    // How many hours past a scheduled hour a once-a-day/week send may still
    // catch up if the exact tick was missed. See inCatchupWindow().
    catchupHours: Number(process.env.PROACTIVE_CATCHUP_HOURS || 4),
    retryDelayMs: Number(process.env.PROACTIVE_RETRY_DELAY_MS || 5000),
    ...config,
  };

  async function tick(now = new Date()) {
    const { dateIso, hour, minute, weekday } = maltaClock(now);

    // ── Morning briefing ──
    if (inCatchupWindow(hour, cfg.morningHour, cfg.catchupHours)) {
      await once(`morning:${dateIso}`, async () => {
        const holiday = maltaHolidayName(dateIso);
        if (holiday) {
          // No pipeline, no calendar, no chasing on a public holiday — a
          // short greeting, with a canned fallback so Beverly still hears
          // from Sam even if the Claude call fails. Low stakes enough that
          // this doesn't warrant an admin alert the way a real briefing
          // failure does.
          const text = await askWithRetry(
            ask,
            `[PROACTIVE HOLIDAY GREETING — today is ${holiday}, a Maltese public holiday. `
            + "Beverly hasn't messaged you, you're initiating.] "
            + `Send her a short, warm greeting for ${holiday}. No briefing, no open items, no agenda — `
            + "today is a holiday. Max 3 short lines. No filler, no AI-isms.",
            "",
            { delayMs: cfg.retryDelayMs },
          ) || `Happy ${holiday}, Beverly! Enjoy the day off — I'll have your full briefing ready tomorrow.`;
          await send(text);
          if (sendVoice) await sendVoice(text);
          return;
        }

        const digest = [await buildMorningDigest({ getCalendar }), await buildFinanceDigest()]
          .filter(Boolean).join("\n\n");
        const text = await askWithRetry(
          ask,
          "[PROACTIVE MORNING BRIEFING — Beverly hasn't messaged you, you're initiating.] "
          + "Open with \"Good morning, Beverly.\" Give her the shape of her day from the briefing data below: "
          + "what's on, what's due, anything that needs a decision. Lead with whatever actually matters most — "
          + "if nothing does, say the day looks clear rather than manufacturing urgency. "
          + "Close with one specific offer of help. Max 6 short lines. No filler, no AI-isms.",
          digest,
          { delayMs: cfg.retryDelayMs },
        );
        if (!text) { await reportGenerationFailure(alertAdmin, "morning briefing"); return; }
        await send(text);
        if (sendVoice) await sendVoice(text);
      });
    }

    // ── Friday debrief ──
    if (weekday === cfg.weeklyDay && inCatchupWindow(hour, cfg.weeklyHour, cfg.catchupHours)) {
      await once(`weekly:${dateIso}`, async () => {
        const digest = [await buildWeeklyDigest(), await buildFinanceDigest()]
          .filter(Boolean).join("\n\n");
        const text = await askWithRetry(
          ask,
          "[PROACTIVE WEEKLY DEBRIEF — end of the working week.] "
          + "Give Beverly a short close-out on the week from the data below: what got finished, what's still open, "
          + "what has slipped, and who has gone quiet. Then ask ONE question that helps her think about next week — "
          + "make it specific to what you can see, not generic. Max 8 short lines.",
          digest,
          { delayMs: cfg.retryDelayMs },
        );
        if (!text) { await reportGenerationFailure(alertAdmin, "weekly debrief"); return; }
        await send(text);
      });
    }

    // ── Overdue chase ──
    if (inCatchupWindow(hour, cfg.chaseHour, cfg.catchupHours)) {
      await once(`chase:${dateIso}`, async () => {
        const due = await dueSoon({ withinDays: 0 });
        // Don't re-chase the same item within 48 hours.
        const chaseable = due.filter(
          (i) => !i.last_chased_at || Date.now() - new Date(i.last_chased_at) > 48 * 3_600_000,
        );
        if (!chaseable.length) return;
        const digest = chaseable
          .map((i) => `- ${i.title}${i.counterparty ? ` [${i.counterparty}]` : ""} (due ${String(i.due_date).slice(0, 10)})`)
          .join("\n");
        const text = await askWithRetry(
          ask,
          "[PROACTIVE CHASE — these commitments are past their due date.] "
          + "Flag them to Beverly plainly. One line each. Ask whether she wants them pushed, dropped, or done today. "
          + "No preamble.",
          digest,
          { delayMs: cfg.retryDelayMs },
        );
        if (!text) { await reportGenerationFailure(alertAdmin, "overdue chase"); return; }
        await send(text);
        await markChased(chaseable.map((i) => i.id));
      });
    }

    // ── Stale relationships ──
    if (weekday === cfg.staleDay && inCatchupWindow(hour, cfg.staleHour, cfg.catchupHours)) {
      await once(`stale:${dateIso}`, async () => {
        const stale = await staleRelationships();
        if (!stale.length) return;
        const digest = stale.slice(0, 8)
          .map((s) => `- ${s.name}${s.org ? ` (${s.org})` : ""} — ${s.days_since} days, cadence ${s.cadence_days}d`)
          .join("\n");
        const text = await askWithRetry(
          ask,
          "[PROACTIVE RELATIONSHIP CHECK.] "
          + "These contacts are past the cadence Beverly set for them. Surface them without nagging — "
          + "she decides who matters. Offer to draft an opener for any of them. Max 6 lines.",
          digest,
          { delayMs: cfg.retryDelayMs },
        );
        if (!text) { await reportGenerationFailure(alertAdmin, "relationship check"); return; }
        await send(text);
        await markRelationshipsAlerted(stale.map((s) => s.name));
      });
    }

    // ── Meeting prep ──
    if (getCalendar && minute % 10 < 1) {
      try {
        const events = await getCalendar(1);
        for (const e of events || []) {
          if (!e.startsAt) continue;
          const minsAway = (new Date(e.startsAt) - Date.now()) / 60_000;
          if (minsAway > cfg.meetingPrepMins || minsAway < cfg.meetingPrepMins - 12) continue;
          await once(`prep:${e.id || `${e.subject}:${e.startsAt}`}`, async () => {
            const related = e.attendees
              ? await listItems({ status: "open", counterparty: String(e.attendees).split(",")[0].trim(), limit: 5 })
              : [];
            const digest = [
              `MEETING: ${e.subject}`,
              e.attendees ? `WITH: ${e.attendees}` : "",
              e.location ? `WHERE: ${e.location}` : "",
              related.length ? `OPEN WITH THEM:\n${related.map((i) => `- ${i.title}`).join("\n")}` : "",
            ].filter(Boolean).join("\n");
            const text = await ask(
              `[PROACTIVE MEETING PREP — starts in about ${Math.round(minsAway)} minutes.] `
              + "Give Beverly a tight prep note: who she's seeing, what's outstanding with them, "
              + "and the one thing worth getting out of the meeting. Max 4 lines. Skip anything you don't actually know.",
              digest,
            );
            if (text) await send(text);
          });
        }
      } catch (err) {
        console.error(`[PROACTIVE] meeting prep: ${err.message}`);
      }
    }

    // ── Watchlist price alerts ──
    if (cfg.watchlistEnabled && marketEnabled() && minute % 15 < 1) {
      try {
        const hits = await checkWatchlistAlerts();
        for (const h of hits) {
          const text = await ask(
            "[PROACTIVE MARKET ALERT — a level Beverly set has been reached.] "
            + "State it in one or two lines: the symbol, the level, where it is now. "
            + "Do not tell her what to do about it — she set the alert, she decides. "
            + "Offer the latest news on the name if she wants it.",
            `${h.symbol} is ${h.direction} ${h.level} — now ${h.price}.${h.note ? ` Her note: ${h.note}` : ""}`,
          );
          if (text) await send(text);
        }
      } catch (err) {
        console.error(`[PROACTIVE] watchlist: ${err.message}`);
      }
    }
  }

  const timer = setInterval(() => {
    tick().catch((err) => console.error(`[PROACTIVE] tick error: ${err.message}`));
  }, 60_000);

  console.log(
    `[PROACTIVE] scheduled — morning ${cfg.morningHour}:00, ${cfg.weeklyDay} debrief ${cfg.weeklyHour}:00, `
    + `chase ${cfg.chaseHour}:00, ${cfg.staleDay} relationships ${cfg.staleHour}:00 `
    + `(each catches up up to ${cfg.catchupHours}h late if its tick is missed), `
    + `meeting prep ${cfg.meetingPrepMins}min ahead, watchlist ${cfg.watchlistEnabled ? "on" : "off"}, `
    + `Malta holiday gate: on`,
  );

  return { stop: () => clearInterval(timer), tick, config: cfg };
}
