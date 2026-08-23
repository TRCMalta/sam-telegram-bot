/**
 * lib/db.js — durable storage for Sam (Beverly Cutajar Shaw's AI chief of staff).
 *
 * Before this module Sam had no persistence at all: conversation history lived
 * in a plain in-process object and the only file on disk was
 * /tmp/sam-last-morning.json, which Railway wipes on every redeploy. Sam forgot
 * Beverly entirely each time we shipped.
 *
 * Everything here degrades gracefully. If DATABASE_URL is not set the module
 * reports unavailable and every caller falls back to the old in-memory
 * behaviour, so Sam keeps running exactly as before while Postgres is being
 * provisioned. Never let a storage fault take Beverly's assistant offline.
 *
 * Config (env):
 *   DATABASE_URL  — Postgres connection string (Railway provides this)
 *   PGSSL         — "off" to disable TLS (Railway *.railway.internal needs none)
 */
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

// Railway's internal network URLs terminate inside the private network and
// present no TLS. Public *.proxy.rlwy.net URLs do. Detect rather than force.
function sslConfig(url) {
  if ((process.env.PGSSL || "").toLowerCase() === "off") return false;
  if (!url) return false;
  if (/\.railway\.internal|localhost|127\.0\.0\.1/.test(url)) return false;
  return { rejectUnauthorized: false };
}

let pool = null;
let ready = false;
let initError = null;

if (DATABASE_URL) {
  pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: sslConfig(DATABASE_URL),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // A pool-level error handler is mandatory: without it a dropped backend
  // connection emits an unhandled 'error' event, which our process-level
  // unhandledRejection handler turns into a hard exit. Sam would restart-loop.
  pool.on("error", (err) => {
    console.error(`[DB] idle client error: ${err.message}`);
  });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id          BIGSERIAL PRIMARY KEY,
  chat_id     TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  content     JSONB       NOT NULL,
  channel     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_chat_idx
  ON conversations (chat_id, created_at DESC);

-- Rolling Hermes-written summaries of turns that have aged out of the live
-- window, so Sam keeps the gist without carrying the tokens.
CREATE TABLE IF NOT EXISTS conversation_summaries (
  chat_id       TEXT PRIMARY KEY,
  summary       TEXT        NOT NULL,
  covers_until  BIGINT      NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commitments, decisions and follow-ups. kind distinguishes them so the
-- proactive layer can chase commitments without nagging about decisions.
CREATE TABLE IF NOT EXISTS open_items (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT        NOT NULL DEFAULT 'commitment',
  title         TEXT        NOT NULL,
  detail        TEXT,
  counterparty  TEXT,
  owner         TEXT        NOT NULL DEFAULT 'beverly',
  due_date      DATE,
  status        TEXT        NOT NULL DEFAULT 'open',
  source        TEXT,
  last_chased_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS open_items_status_idx ON open_items (status, due_date);

CREATE TABLE IF NOT EXISTS relationships (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT        NOT NULL UNIQUE,
  org             TEXT,
  role            TEXT,
  cadence_days    INTEGER,
  last_contact_at TIMESTAMPTZ,
  last_alerted_at TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generic key/value for scheduler dedupe keys and small bits of state.
-- Replaces the ephemeral /tmp/sam-last-morning.json.
CREATE TABLE IF NOT EXISTS kv (
  k          TEXT PRIMARY KEY,
  v          JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Beverly's personal finances ────────────────────────────────────────────
-- Sam is an analyst and record-keeper here, never a broker. Nothing in this
-- schema stores broker credentials and nothing supports order placement.

CREATE TABLE IF NOT EXISTS holdings (
  id          BIGSERIAL PRIMARY KEY,
  account     TEXT        NOT NULL DEFAULT 'default',
  symbol      TEXT        NOT NULL,
  name        TEXT,
  asset_class TEXT        NOT NULL DEFAULT 'equity',
  quantity    NUMERIC     NOT NULL DEFAULT 0,
  avg_cost    NUMERIC,
  currency    TEXT        NOT NULL DEFAULT 'EUR',
  -- Fixed income only. Null for equities and ETFs.
  coupon_rate NUMERIC,
  maturity    DATE,
  source      TEXT        NOT NULL DEFAULT 'chat',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account, symbol)
);

CREATE TABLE IF NOT EXISTS trades (
  id         BIGSERIAL PRIMARY KEY,
  account    TEXT        NOT NULL DEFAULT 'default',
  symbol     TEXT        NOT NULL,
  side       TEXT        NOT NULL,
  quantity   NUMERIC     NOT NULL,
  price      NUMERIC     NOT NULL,
  currency   TEXT        NOT NULL DEFAULT 'EUR',
  fees       NUMERIC     NOT NULL DEFAULT 0,
  traded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source     TEXT        NOT NULL DEFAULT 'chat',
  -- Broker's own id, so re-importing a statement is idempotent.
  external_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trades_symbol_idx ON trades (symbol, traded_at DESC);

-- The discipline layer. A hobby trader improves by writing the thesis down
-- BEFORE the outcome is known, then reviewing honestly. This is where Sam
-- adds more value than any price feed.
CREATE TABLE IF NOT EXISTS trade_journal (
  id         BIGSERIAL PRIMARY KEY,
  trade_id   BIGINT REFERENCES trades(id) ON DELETE SET NULL,
  symbol     TEXT        NOT NULL,
  thesis     TEXT,
  emotion    TEXT,
  plan_exit  NUMERIC,
  plan_stop  NUMERIC,
  outcome    TEXT,
  lesson     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proactive messages WhatsApp rejected (Meta's 24-hour window). Beverly uses
-- no other channel, so instead of a dead-end fallback the message waits here
-- and is delivered the moment her next inbound message reopens the window.
CREATE TABLE IF NOT EXISTS pending_proactive (
  id           BIGSERIAL PRIMARY KEY,
  body         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS watchlist (
  id          BIGSERIAL PRIMARY KEY,
  symbol      TEXT        NOT NULL UNIQUE,
  note        TEXT,
  alert_above NUMERIC,
  alert_below NUMERIC,
  last_alerted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function initDb() {
  if (!pool) {
    console.log("[DB] DATABASE_URL not set — running in memory-only mode (Sam will forget on restart)");
    return false;
  }
  try {
    await pool.query(SCHEMA);
    ready = true;
    console.log("[DB] schema ready");
    return true;
  } catch (err) {
    initError = err;
    ready = false;
    console.error(`[DB] init failed, falling back to memory-only mode: ${err.message}`);
    return false;
  }
}

export function dbAvailable() {
  return ready;
}

export function dbStatus() {
  if (!DATABASE_URL) return "not configured";
  if (ready) return "ready";
  return `unavailable: ${initError ? initError.message : "initialising"}`;
}

/**
 * Run a query. Returns null (never throws) when storage is unavailable so a
 * database outage degrades Sam's memory rather than breaking his replies.
 */
export async function q(text, params = []) {
  if (!ready || !pool) return null;
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error(`[DB] query failed: ${err.message}`);
    return null;
  }
}

export async function kvGet(key, fallback = null) {
  const r = await q("SELECT v FROM kv WHERE k = $1", [key]);
  if (!r || !r.rows.length) return fallback;
  return r.rows[0].v;
}

export async function kvSet(key, value) {
  await q(
    `INSERT INTO kv (k, v, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

// ─── Pending proactive queue ────────────────────────────────────────────────

export async function queueProactive(body) {
  const r = await q("INSERT INTO pending_proactive (body) VALUES ($1) RETURNING id", [body]);
  return r && r.rows.length ? r.rows[0].id : null;
}

/** Undelivered items, oldest first, capped so a long absence doesn't flood her. */
export async function undeliveredProactive(limit = 5) {
  const r = await q(
    `SELECT id, body, created_at FROM pending_proactive
     WHERE delivered_at IS NULL ORDER BY id ASC LIMIT $1`, [limit],
  );
  return r ? r.rows : [];
}

export async function markProactiveDelivered(ids) {
  if (!ids.length) return;
  await q("UPDATE pending_proactive SET delivered_at = now() WHERE id = ANY($1::bigint[])", [ids]);
}

export async function closeDb() {
  if (pool) await pool.end().catch(() => {});
}
