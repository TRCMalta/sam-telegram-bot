/**
 * lib/gordon.js — notify Gordon, the autonomous engineer watching TRC's bots.
 *
 * Gordon lives in a Telegram ops group (Jonathan + Rachel) and exposes
 * POST /internal/alert on his own Railway service. Whatever arrives there
 * gets folded into his next agent turn and surfaces in that group.
 *
 * Sam is not Gordon's repo to fix — Gordon has no tools pointed at
 * sam-telegram-bot, no clone, no write access here. This is one-way
 * visibility only: Sam tells Gordon's group when something operational is
 * wrong, exactly like Sam already tells his own admin Telegram chat. It does
 * not give Gordon any ability to act on Sam.
 *
 * Fails completely soft: an unset config, a network failure, a bad response —
 * none of it may block or delay Sam's own alertAdmin() path. Gordon is a
 * bonus channel, never a dependency.
 *
 * Config (env, both optional — unset means "don't notify Gordon"):
 *   GORDON_INTERNAL_URL  — e.g. https://gordon-production-xxxx.up.railway.app
 *                          (Railway → project blissful-forgiveness → service
 *                          gordon → Settings → Networking → Public Domain)
 *   GORDON_ALERT_SECRET  — must equal Gordon's own TELEGRAM_WEBHOOK_SECRET,
 *                          copied by hand from the gordon Railway service —
 *                          it lives in a different Railway project than Sam,
 *                          so there is no ${{cross-project}} variable
 *                          reference shortcut for it. Ask for the value
 *                          directly; never guess or invent one — a
 *                          mismatched secret just means Gordon silently
 *                          401s and this channel stays dark with no error
 *                          anyone sees.
 */
const GORDON_INTERNAL_URL = (process.env.GORDON_INTERNAL_URL || "").trim().replace(/\/+$/, "");
const GORDON_ALERT_SECRET = (process.env.GORDON_ALERT_SECRET || "").trim();
const GORDON_ALERT_TIMEOUT_MS = 8_000;

export function gordonEnabled() {
  return Boolean(GORDON_INTERNAL_URL && GORDON_ALERT_SECRET);
}

/**
 * @param title     short label Gordon's operators see, e.g. "Sam: WhatsApp send rejected"
 * @param message   body text. Keep this to operational facts — this reaches a
 *                  group with more members than Sam's own admin chat, so it
 *                  should never carry a preview of what Sam was telling Beverly.
 * @param severity  'info' | 'warning' | 'critical'
 * @returns true if Gordon accepted it, false otherwise (logged, never thrown)
 */
/**
 * The operational facts for a rejected proactive WhatsApp send, with nothing
 * about what Sam was actually telling Beverly. Used as both a component of
 * the full admin-chat alert and, standalone, as Gordon's entire message body
 * — Gordon's group has members beyond whoever is on ADMIN_TELEGRAM_CHAT_IDS,
 * so this is the boundary that keeps her content out of that wider group.
 *
 * Deliberately a pure function: given the same inputs it always produces the
 * same three lines, with nothing content-derived threaded through it. That
 * makes "does this leak anything" a property test can actually check.
 */
export function describeProactiveRejection({
  windowClosed, waError, waCode, queuedId, templateConfigured, nudged,
}) {
  return (
    (windowClosed
      ? `Cause: Meta 24-hour window — Beverly hasn't messaged Sam in over 24h (error 131047).\n`
      : `Cause: ${waError || "unknown"} (code ${waCode ?? "n/a"})\n`)
    + (queuedId
        ? `Message queued (#${queuedId}) — she'll get it the moment she next messages Sam.\n`
        : `NOT queued — database unavailable, this message is lost.\n`)
    + (windowClosed
        ? (templateConfigured
            ? (nudged ? `Template nudge sent to reopen the window.\n` : `Template nudge skipped (already nudged recently, or send failed).\n`)
            : `No template configured — register one via POST /admin/register-template, then set WA_TEMPLATE_NAME.\n`)
        : "")
  );
}

export async function notifyGordon(title, message, severity = "warning") {
  if (!gordonEnabled()) return false;
  try {
    const res = await fetch(`${GORDON_INTERNAL_URL}/internal/alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": GORDON_ALERT_SECRET,
      },
      body: JSON.stringify({ title, message, severity }),
      signal: AbortSignal.timeout(GORDON_ALERT_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[GORDON] alert rejected: HTTP ${res.status}${res.status === 401 ? " — GORDON_ALERT_SECRET likely wrong" : ""}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[GORDON] alert failed: ${err.name === "TimeoutError" ? "timeout" : err.message}`);
    return false;
  }
}
