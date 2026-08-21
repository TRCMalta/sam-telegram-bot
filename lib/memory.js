/**
 * lib/memory.js — Sam's long-term memory of Beverly.
 *
 * Replaces the in-process conversationHistory object. That object had two
 * problems: a Railway redeploy erased it completely, and a 30-minute idle
 * timeout meant Sam started every morning as a stranger.
 *
 * Structure:
 *   - A live window of recent turns, replayed verbatim to Claude.
 *   - A rolling Hermes-written summary of everything older, carried in the
 *     system prompt instead of as messages. Sam keeps the substance of a long
 *     relationship without paying for every token of it.
 *
 * The in-memory cache is kept as a fast path and as the fallback when the
 * database is unavailable, so behaviour degrades to exactly what it was
 * before rather than failing.
 */
import { q, dbAvailable } from "./db.js";
import { summariseTurns } from "./llm.js";

// Turns replayed verbatim. Older ones fold into the summary.
const LIVE_WINDOW = Number(process.env.MEMORY_LIVE_TURNS || 24);
// Compress once this many un-summarised turns have built up.
const COMPRESS_AFTER = Number(process.env.MEMORY_COMPRESS_AFTER || 40);

const cache = new Map(); // chatId -> { messages: [...], summary, loadedAt }
const MAX_CACHED_CHATS = 50;

function cacheGet(chatId) {
  return cache.get(chatId);
}

function cachePut(chatId, value) {
  if (!cache.has(chatId) && cache.size >= MAX_CACHED_CHATS) {
    // Evict the least recently loaded.
    let oldest = null, oldestAt = Infinity;
    for (const [k, v] of cache) if (v.loadedAt < oldestAt) { oldest = k; oldestAt = v.loadedAt; }
    if (oldest) cache.delete(oldest);
  }
  cache.set(chatId, value);
}

/**
 * Load the conversation context for a chat.
 *
 * Returns { messages, summary }. `messages` is ready to spread into the Claude
 * messages array; `summary` belongs in the system prompt, not in messages —
 * injecting it as a turn would break user/assistant alternation.
 */
export async function loadContext(chatId) {
  const cached = cacheGet(chatId);
  if (cached) return { messages: cached.messages, summary: cached.summary };

  if (!dbAvailable()) {
    const fresh = { messages: [], summary: null, loadedAt: Date.now() };
    cachePut(chatId, fresh);
    return { messages: [], summary: null };
  }

  const [turns, summaryRow] = await Promise.all([
    q(`SELECT role, content FROM conversations
       WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2`, [chatId, LIVE_WINDOW]),
    q("SELECT summary FROM conversation_summaries WHERE chat_id = $1", [chatId]),
  ]);

  const messages = turns
    ? turns.rows.reverse().map((r) => ({ role: r.role, content: r.content }))
    : [];
  const summary = summaryRow && summaryRow.rows.length ? summaryRow.rows[0].summary : null;

  // Claude requires the first message to be from the user. If the window
  // happens to start on an assistant turn, drop it rather than send an
  // invalid conversation.
  while (messages.length && messages[0].role !== "user") messages.shift();

  cachePut(chatId, { messages, summary, loadedAt: Date.now() });
  return { messages, summary };
}

export async function saveTurn(chatId, role, content, channel = "telegram") {
  const cached = cacheGet(chatId);
  if (cached) {
    cached.messages.push({ role, content });
    if (cached.messages.length > LIVE_WINDOW) {
      cached.messages = cached.messages.slice(-LIVE_WINDOW);
      while (cached.messages.length && cached.messages[0].role !== "user") cached.messages.shift();
    }
  }
  if (!dbAvailable()) return;
  await q(
    "INSERT INTO conversations (chat_id, role, content, channel) VALUES ($1,$2,$3,$4)",
    [chatId, role, JSON.stringify(content), channel],
  );
}

/**
 * Fold turns that have aged out of the live window into the rolling summary.
 *
 * Called after a reply is sent, so the compression cost never sits in
 * Beverly's response latency.
 */
export async function maybeCompress(chatId) {
  if (!dbAvailable()) return false;

  const state = await q(
    `SELECT
       (SELECT COUNT(*) FROM conversations c WHERE c.chat_id = $1) AS total,
       (SELECT covers_until FROM conversation_summaries s WHERE s.chat_id = $1) AS covers_until`,
    [chatId],
  );
  if (!state || !state.rows.length) return false;

  const total = Number(state.rows[0].total || 0);
  const coversUntil = Number(state.rows[0].covers_until || 0);

  // Turns not yet summarised, excluding the live window we still replay verbatim.
  const unsummarised = await q(
    `SELECT id, role, content FROM conversations
     WHERE chat_id = $1 AND id > $2
     ORDER BY id ASC
     LIMIT GREATEST(0, (SELECT COUNT(*) FROM conversations WHERE chat_id = $1 AND id > $2) - $3)`,
    [chatId, coversUntil, LIVE_WINDOW],
  );
  if (!unsummarised || unsummarised.rows.length < COMPRESS_AFTER) return false;

  const previous = await q("SELECT summary FROM conversation_summaries WHERE chat_id = $1", [chatId]);
  const priorSummary = previous && previous.rows.length ? previous.rows[0].summary : null;

  const turns = unsummarised.rows.map((r) => ({ role: r.role, content: r.content }));
  if (priorSummary) {
    turns.unshift({ role: "user", content: `[Earlier notes about Beverly]\n${priorSummary}` });
  }

  const summary = await summariseTurns(turns);
  if (!summary) return false;   // Hermes unavailable — try again next time

  const newestId = unsummarised.rows[unsummarised.rows.length - 1].id;
  await q(
    `INSERT INTO conversation_summaries (chat_id, summary, covers_until, updated_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (chat_id) DO UPDATE SET
       summary = EXCLUDED.summary, covers_until = EXCLUDED.covers_until, updated_at = now()`,
    [chatId, summary, newestId],
  );

  const cached = cacheGet(chatId);
  if (cached) cached.summary = summary;

  console.log(`[MEMORY] compressed ${unsummarised.rows.length} turns for ${chatId} (total ${total})`);
  return true;
}

/**
 * Recover from a context-length error.
 *
 * Drops the cached live window and forces the aged-out turns into the summary,
 * so the next message starts from a much smaller context. Deliberately does
 * NOT delete the stored conversation — losing Beverly's long-term memory
 * because one message ran long would be a far worse outcome than a truncated
 * reply.
 */
export async function resetLiveWindow(chatId) {
  cache.delete(chatId);
  if (!dbAvailable()) return;
  // Summarise everything except the newest few turns, shrinking what gets replayed.
  const rows = await q(
    `SELECT id FROM conversations WHERE chat_id = $1 ORDER BY id DESC LIMIT 4`, [chatId],
  );
  if (!rows || !rows.rows.length) return;
  const keepFrom = rows.rows[rows.rows.length - 1].id;
  const older = await q(
    `SELECT id, role, content FROM conversations WHERE chat_id = $1 AND id < $2 ORDER BY id ASC`,
    [chatId, keepFrom],
  );
  if (!older || older.rows.length < 2) return;
  const summary = await summariseTurns(older.rows.map((r) => ({ role: r.role, content: r.content })));
  if (!summary) return;
  await q(
    `INSERT INTO conversation_summaries (chat_id, summary, covers_until, updated_at)
     VALUES ($1,$2,$3, now())
     ON CONFLICT (chat_id) DO UPDATE SET
       summary = EXCLUDED.summary, covers_until = EXCLUDED.covers_until, updated_at = now()`,
    [chatId, summary, older.rows[older.rows.length - 1].id],
  );
  console.log(`[MEMORY] reset live window for ${chatId}, summarised ${older.rows.length} turns`);
}

/** Drop a chat's memory entirely. Used by an explicit "forget this" request. */
export async function forgetChat(chatId) {
  cache.delete(chatId);
  await q("DELETE FROM conversations WHERE chat_id = $1", [chatId]);
  await q("DELETE FROM conversation_summaries WHERE chat_id = $1", [chatId]);
}

export function memoryStats() {
  return { cachedChats: cache.size, liveWindow: LIVE_WINDOW, compressAfter: COMPRESS_AFTER };
}
