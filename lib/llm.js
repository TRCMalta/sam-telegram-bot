/**
 * lib/llm.js — model routing for Sam.
 *
 * Sam's expensive habit: every Claude call carries the full system prompt
 * (~4.1K tokens) plus all tool schemas (~4.1K tokens), and the tool-use loop
 * re-sends both on every iteration. A message needing three tool rounds cost
 * ~33K input tokens before history or results.
 *
 * The fix is a division of labour:
 *   Hermes (via OpenRouter)  — internal machinery Beverly never reads:
 *                              intent classification, tool-result condensing,
 *                              history compression, structured extraction.
 *   Claude                   — everything Beverly actually reads. Sam's voice,
 *                              judgement and coaching stay on the good model.
 *
 * Hermes 4 70B is ~23x cheaper per input token than Claude Sonnet, and these
 * jobs are mechanical enough that the quality difference is invisible.
 *
 * Every function here fails soft — returns null on any error so the caller
 * falls back to the original Claude path. A router outage must never cost
 * Beverly a reply.
 *
 * Config (env):
 *   OPENROUTER_API_KEY  — required to enable routing; absent = everything on Claude
 *   HERMES_MODEL        — default nousresearch/hermes-4-70b
 *   HERMES_HEAVY_MODEL  — default nousresearch/hermes-4-405b (harder extraction)
 *   HERMES_TIMEOUT_MS   — default 20000
 */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const HERMES_MODEL       = process.env.HERMES_MODEL || "nousresearch/hermes-4-70b";
const HERMES_HEAVY_MODEL = process.env.HERMES_HEAVY_MODEL || "nousresearch/hermes-4-405b";
const HERMES_TIMEOUT_MS  = Number(process.env.HERMES_TIMEOUT_MS || 20_000);
const OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions";

// Rough running tally so /health can show what routing is actually saving.
const stats = { calls: 0, failures: 0, inTokens: 0, outTokens: 0, claudeCallsAvoided: 0 };

export function routerEnabled() {
  return Boolean(OPENROUTER_API_KEY);
}

export function routerStats() {
  return { ...stats, model: HERMES_MODEL, enabled: routerEnabled() };
}

/**
 * Headers for an OpenRouter request.
 *
 * Every value here MUST be latin-1 encodable. fetch() rejects header values
 * containing any character above U+00FF with a ByteString error, and because
 * hermes() catches everything and returns null, such a throw is invisible: the
 * router silently never works and every request quietly falls back to Claude.
 * An em dash in the X-Title once did exactly that. Keep these ASCII, and see
 * test/headers.test.mjs which enforces it.
 */
export function openRouterHeaders() {
  return {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    // OpenRouter uses these two for attribution on their dashboard.
    "HTTP-Referer": "https://trc.com.mt",
    "X-Title": "Sam - TRC Chief of Staff",
  };
}

/**
 * Raw Hermes call. Returns the assistant text, or null on any failure.
 */
export async function hermes(prompt, {
  system = "You are a precise back-office text processor. Follow instructions exactly. Output nothing but what is asked for.",
  maxTokens = 700,
  temperature = 0,
  heavy = false,
} = {}) {
  if (!OPENROUTER_API_KEY) return null;
  const t = Date.now();
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: heavy ? HERMES_HEAVY_MODEL : HERMES_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
      signal: AbortSignal.timeout(HERMES_TIMEOUT_MS),
    });
    if (!res.ok) {
      stats.failures++;
      console.error(`[HERMES] HTTP ${res.status} after ${Date.now() - t}ms`);
      return null;
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text) {
      stats.failures++;
      return null;
    }
    stats.calls++;
    stats.inTokens += json?.usage?.prompt_tokens || 0;
    stats.outTokens += json?.usage?.completion_tokens || 0;
    return text.trim();
  } catch (err) {
    stats.failures++;
    console.error(`[HERMES] ${err.name === "TimeoutError" ? "timeout" : err.message} after ${Date.now() - t}ms`);
    return null;
  }
}

// Tolerate a model that wraps JSON in prose or a ```json fence.
function parseLooseJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[{[]/);
  if (start === -1) return null;
  // Walk back from the end for the matching close, so trailing prose is ignored.
  for (let end = body.length; end > start; end--) {
    const slice = body.slice(start, end);
    if (!/[}\]]$/.test(slice.trim())) continue;
    try { return JSON.parse(slice); } catch { /* keep shrinking */ }
  }
  return null;
}

/**
 * Which tool groups does this message actually need?
 *
 * Sam has tools across six domains. Sending all of them on every call is
 * where most of the token budget goes. Hermes picks the relevant subset for
 * a fraction of a cent; a null return means "we don't know", and the caller
 * sends everything, exactly as before.
 */
export const TOOL_DOMAINS = ["odoo", "firefish", "m365", "web", "finance", "memory"];

export async function classifyDomains(message) {
  if (!OPENROUTER_API_KEY) return null;
  const out = await hermes(
    `Classify which data domains this message from Beverly (COO of a Malta professional-services group) needs.

Domains:
- odoo     : Think Talent CRM — training/coaching leads, deals, invoices, products, events, sales orders
- firefish : Ceek Talent recruitment — candidates, jobs, placements, recruitment pipeline
- m365     : Beverly's own email and calendar
- web      : web search, browsing a URL, looking up a company or competitor
- finance  : her PERSONAL portfolio, trades, watchlist, investment projections, markets
- memory   : her commitments, open items, past decisions, people she owes a follow-up

Rules:
- Return every domain that could plausibly be needed, but no more.
- Smalltalk, thanks, or a question answerable from conversation alone: return [].
- When genuinely unsure, include the domain rather than omit it.

Message: """${message.slice(0, 1500)}"""

Reply with ONLY a JSON array of domain strings. Example: ["finance"]`,
    { maxTokens: 60 },
  );
  const parsed = parseLooseJson(out);
  if (!Array.isArray(parsed)) return null;
  const clean = parsed.filter((d) => TOOL_DOMAINS.includes(d));
  // Distinguish "confidently nothing" from "parse produced junk".
  if (!clean.length && parsed.length) return null;
  stats.claudeCallsAvoided++;
  return clean;
}

/**
 * Squash a large tool result before it enters Claude's context.
 *
 * A 500-row Odoo dump can be 20K+ tokens, and it gets re-sent on every
 * subsequent iteration of the tool-use loop. Condensing once pays for itself
 * several times over.
 */
export async function condenseToolResult(toolName, result, userGoal) {
  if (!OPENROUTER_API_KEY) return null;
  if (typeof result !== "string" || result.length < 4000) return null;
  const out = await hermes(
    `Condense this tool output so an assistant can answer the user's question from it alone.

Keep: every figure, name, date, ID and status that bears on the question. Preserve exact numbers — never round or estimate.
Drop: repetition, boilerplate, records irrelevant to the question.
If the output is a long list, keep the most relevant entries and state how many were omitted.

User's question: """${(userGoal || "").slice(0, 500)}"""
Tool: ${toolName}

Output:
"""${result.slice(0, 60_000)}"""

Return only the condensed text.`,
    { maxTokens: 1400 },
  );
  if (!out) return null;
  // Only worth it if we actually saved something meaningful.
  if (out.length >= result.length * 0.75) return null;
  return out;
}

/**
 * Roll older conversation turns into a compact summary so Sam keeps the gist
 * of a long relationship without carrying every token of it.
 */
export async function summariseTurns(turns) {
  if (!OPENROUTER_API_KEY || !turns.length) return null;
  const transcript = turns
    .map((m) => {
      const body = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${m.role.toUpperCase()}: ${body.slice(0, 2000)}`;
    })
    .join("\n\n");
  return await hermes(
    `Summarise this conversation between Beverly and her chief of staff into durable notes.

Capture, as terse bullets:
- Decisions she made and the reasoning
- Commitments made, by her or to her, and to whom
- Preferences she expressed about how she wants things done
- Facts about people, clients and deals worth remembering
- Anything left unresolved

Omit pleasantries and anything already actioned and closed. Write in third person about Beverly. Max 300 words.

Transcript:
${transcript.slice(0, 50_000)}`,
    { maxTokens: 500 },
  );
}

/**
 * Pull structured data out of free text — a broker statement line, a trade
 * described in passing, a commitment mentioned mid-sentence. Uses the heavy
 * model because a mis-parsed number here corrupts Beverly's records.
 */
export async function extractJson(instruction, text, { heavy = true } = {}) {
  if (!OPENROUTER_API_KEY) return null;
  const out = await hermes(
    `${instruction}\n\nInput:\n"""${text.slice(0, 30_000)}"""\n\nReturn ONLY valid JSON. No commentary.`,
    { maxTokens: 2000, heavy },
  );
  return parseLooseJson(out);
}

/**
 * Deterministic keyword classifier — the fallback when Hermes is unavailable.
 *
 * Without this, an unclassified message sends all 43 tool schemas, which is
 * MORE expensive than the original 24 and turns a router outage into a cost
 * regression. This costs nothing, needs no network, and errs generous: a
 * domain is included on any hint, because sending one tool group too many is
 * far cheaper than Sam being unable to answer.
 *
 * Returns null when there is genuinely no signal, which the caller treats as
 * "send everything".
 */
const DOMAIN_HINTS = {
  odoo: /\b(odoo|crm|lead|leads|opportunit|deal|deals|pipeline|stage|quotation|invoice|sales order|proposal|course|training|coaching|think talent|myskills|get qualified|jobsplus|mfhea|tag|tags|salesperson)\b/i,
  firefish: /\b(firefish|ceek|recruit|recruitment|candidate|candidates|placement|placements|vacanc|job ad|shortlist|cv|hire|hiring|role|roles)\b/i,
  m365: /\b(email|emails|inbox|mail|message from|calendar|diary|schedule|meeting|meetings|appointment|invite|availability|free time|reply to|send.*(email|note)|draft)\b/i,
  web: /\b(search|google|look ?up|find out|website|url|http|browse|news about|competitor|flight|flights|hotel|restaurant|travel|book a|weather)\b/i,
  finance: /\b(invest|investment|investing|portfolio|holding|holdings|share|shares|stock|stocks|equit|etf|fund|bond|bonds|coupon|maturity|dividend|trade|trading|traded|bought|sold|buy|sell|position|ticker|market|price|quote|s&p|nasdaq|compound|compounded|return|returns|yield|profit|loss|p&l|watchlist|broker|trading ?212|t212|nvda|aapl|tsla)\b/i,
  memory: /\b(remind|reminder|owe|owed|promis|commit|commitment|outstanding|open item|follow[ -]?up|chase|due|deadline|decided|decision|action item|to ?do|catch up with|spoke to|last time)\b/i,
};

export function heuristicDomains(message) {
  if (typeof message !== "string" || !message.trim()) return null;
  const hits = TOOL_DOMAINS.filter((d) => DOMAIN_HINTS[d] && DOMAIN_HINTS[d].test(message));
  return hits.length ? hits : null;
}
