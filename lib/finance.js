/**
 * lib/finance.js — Beverly's personal portfolio, trades and trading discipline.
 *
 * SCOPE BOUNDARY, deliberate and load-bearing: Sam records, values, analyses
 * and coaches. Sam never places, modifies or cancels an order, and holds no
 * broker write credentials. The Trading 212 key used here is read-only by
 * intent; nothing in this module calls an order endpoint.
 *
 * TRC's standing rule for personal finance (from the investments-context
 * skill) applies to every output: this is analysis and information, not
 * regulated advice, and anything that turns on Beverly's tax position or risk
 * capacity gets pointed at a licensed adviser.
 *
 * Config (env):
 *   T212_API_KEY   — Trading 212 read key (optional)
 *   T212_ENV       — "live" (default) or "demo"
 *   BASE_CURRENCY  — default EUR
 */
import { q, dbAvailable } from "./db.js";
import { getQuote, getQuotes, convert, marketEnabled } from "./market.js";
import { extractJson } from "./llm.js";

const BASE_CURRENCY = process.env.BASE_CURRENCY || "EUR";
const T212_API_KEY = process.env.T212_API_KEY;
const T212_BASE = (process.env.T212_ENV || "live") === "demo"
  ? "https://demo.trading212.com/api/v0"
  : "https://live.trading212.com/api/v0";

// ─── Holdings ────────────────────────────────────────────────────────────────

export async function upsertHolding({
  symbol, name = null, assetClass = "equity", quantity, avgCost = null,
  currency = BASE_CURRENCY, couponRate = null, maturity = null,
  account = "default", source = "chat",
}) {
  const r = await q(
    `INSERT INTO holdings (account, symbol, name, asset_class, quantity, avg_cost, currency, coupon_rate, maturity, source, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     ON CONFLICT (account, symbol) DO UPDATE SET
       quantity = EXCLUDED.quantity,
       avg_cost = COALESCE(EXCLUDED.avg_cost, holdings.avg_cost),
       name = COALESCE(EXCLUDED.name, holdings.name),
       asset_class = EXCLUDED.asset_class,
       currency = EXCLUDED.currency,
       coupon_rate = COALESCE(EXCLUDED.coupon_rate, holdings.coupon_rate),
       maturity = COALESCE(EXCLUDED.maturity, holdings.maturity),
       source = EXCLUDED.source,
       updated_at = now()
     RETURNING *`,
    [account, String(symbol).toUpperCase(), name, assetClass, quantity, avgCost,
     currency, couponRate, maturity, source],
  );
  return r ? r.rows[0] : null;
}

export async function removeHolding(symbol, account = "default") {
  const r = await q(
    "DELETE FROM holdings WHERE account = $1 AND symbol = $2 RETURNING symbol",
    [account, String(symbol).toUpperCase()],
  );
  return Boolean(r && r.rowCount);
}

export async function listHoldings(account = null) {
  const r = account
    ? await q("SELECT * FROM holdings WHERE account = $1 ORDER BY symbol", [account])
    : await q("SELECT * FROM holdings ORDER BY account, symbol");
  return r ? r.rows : [];
}

/**
 * Value the portfolio at current prices.
 *
 * Anything we cannot price or convert is reported honestly in a `problems`
 * list rather than silently valued at zero or at cost — a portfolio total
 * that quietly omits a holding is worse than no total.
 */
export async function valuePortfolio(account = null) {
  const holdings = await listHoldings(account);
  if (!holdings.length) return { holdings: [], total: 0, problems: [], priced: false };

  const symbols = [...new Set(holdings.filter(h => h.asset_class !== "cash").map(h => h.symbol))];
  const quotes = marketEnabled() ? await getQuotes(symbols) : {};
  const problems = [];
  let total = 0;
  let totalCost = 0;
  let dayChange = 0;

  const rows = [];
  for (const h of holdings) {
    const qty = Number(h.quantity);
    const avgCost = h.avg_cost === null ? null : Number(h.avg_cost);

    if (h.asset_class === "cash") {
      const v = await convert(qty, h.currency, BASE_CURRENCY);
      if (v === null) { problems.push(`${h.symbol}: no ${h.currency}→${BASE_CURRENCY} rate`); }
      else { total += v; totalCost += v; }
      rows.push({ ...h, quantity: qty, price: 1, valueBase: v, native: qty });
      continue;
    }

    const qt = quotes[h.symbol];
    if (!qt) {
      problems.push(`${h.symbol}: no price available`);
      rows.push({ ...h, quantity: qty, price: null, valueBase: null });
      continue;
    }

    const nativeValue = qty * qt.price;
    const valueBase = await convert(nativeValue, h.currency, BASE_CURRENCY);
    if (valueBase === null) {
      problems.push(`${h.symbol}: no ${h.currency}→${BASE_CURRENCY} rate`);
    } else {
      total += valueBase;
      dayChange += (qt.change || 0) * qty * (valueBase / (nativeValue || 1));
      if (avgCost !== null) {
        const costBase = await convert(qty * avgCost, h.currency, BASE_CURRENCY);
        if (costBase !== null) totalCost += costBase;
      }
    }

    rows.push({
      ...h,
      quantity: qty,
      price: qt.price,
      changePct: qt.changePct,
      native: nativeValue,
      valueBase,
      unrealised: avgCost === null ? null : (qt.price - avgCost) * qty,
      unrealisedPct: avgCost ? ((qt.price - avgCost) / avgCost) * 100 : null,
    });
  }

  // Allocation only makes sense across the holdings we could actually price.
  for (const r of rows) {
    r.weightPct = r.valueBase !== null && total > 0 ? (r.valueBase / total) * 100 : null;
  }
  rows.sort((a, b) => (b.valueBase ?? -1) - (a.valueBase ?? -1));

  return {
    holdings: rows,
    total,
    totalCost,
    unrealised: totalCost > 0 ? total - totalCost : null,
    unrealisedPct: totalCost > 0 ? ((total - totalCost) / totalCost) * 100 : null,
    dayChange,
    currency: BASE_CURRENCY,
    problems,
    priced: marketEnabled(),
  };
}

/** Allocation by asset class — the check that matters for a mixed equity/bond book. */
export function allocationByClass(valued) {
  const buckets = {};
  for (const h of valued.holdings) {
    if (h.valueBase === null) continue;
    buckets[h.asset_class] = (buckets[h.asset_class] || 0) + h.valueBase;
  }
  return Object.entries(buckets)
    .map(([cls, v]) => ({ assetClass: cls, value: v, pct: valued.total > 0 ? (v / valued.total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

// ─── Trades ──────────────────────────────────────────────────────────────────

export async function recordTrade({
  symbol, side, quantity, price, currency = BASE_CURRENCY, fees = 0,
  tradedAt = null, account = "default", source = "chat", externalId = null,
}) {
  const r = await q(
    `INSERT INTO trades (account, symbol, side, quantity, price, currency, fees, traded_at, source, external_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, now()), $9, $10)
     ON CONFLICT (external_id) DO NOTHING
     RETURNING *`,
    [account, String(symbol).toUpperCase(), String(side).toLowerCase(),
     quantity, price, currency, fees, tradedAt, source, externalId],
  );
  return r && r.rows.length ? r.rows[0] : null;
}

export async function listTrades({ symbol = null, since = null, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (symbol) { params.push(String(symbol).toUpperCase()); where.push(`symbol = $${params.length}`); }
  if (since)  { params.push(since); where.push(`traded_at >= $${params.length}`); }
  params.push(limit);
  const r = await q(
    `SELECT * FROM trades ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY traded_at DESC LIMIT $${params.length}`,
    params,
  );
  return r ? r.rows : [];
}

/**
 * FIFO realised P&L.
 *
 * FIFO is the default cost-basis method under most European regimes and is
 * what a broker statement will reconcile against. Buys form a queue; each sell
 * consumes the oldest lots first. Fees are attributed to the disposal that
 * incurred them.
 *
 * Returns per-symbol realised results plus the open lots still held, so the
 * same pass gives both realised P&L and a cost basis for the open position.
 */
export function fifoRealised(trades) {
  // Oldest first — FIFO is meaningless on a reverse-chronological list.
  const ordered = [...trades].sort((a, b) => new Date(a.traded_at) - new Date(b.traded_at));
  const lots = {};       // symbol -> [{ qty, price, fees, at }]
  const closed = [];     // individual round trips

  for (const t of ordered) {
    const sym = t.symbol;
    const qty = Math.abs(Number(t.quantity));
    const price = Number(t.price);
    const fees = Number(t.fees || 0);
    lots[sym] = lots[sym] || [];

    if (String(t.side).toLowerCase() === "buy") {
      lots[sym].push({ qty, price, fees, at: t.traded_at });
      continue;
    }

    // Sell: consume oldest lots first.
    let remaining = qty;
    let proceedsFees = fees;
    while (remaining > 0 && lots[sym].length) {
      const lot = lots[sym][0];
      const take = Math.min(remaining, lot.qty);
      // Apportion each side's fees across the quantity they covered.
      const buyFeeShare = lot.qty > 0 ? (lot.fees * take) / lot.qty : 0;
      const sellFeeShare = qty > 0 ? (proceedsFees * take) / qty : 0;
      const pnl = (price - lot.price) * take - buyFeeShare - sellFeeShare;

      closed.push({
        symbol: sym,
        quantity: take,
        buyPrice: lot.price,
        sellPrice: price,
        openedAt: lot.at,
        closedAt: t.traded_at,
        holdingDays: (new Date(t.traded_at) - new Date(lot.at)) / 86_400_000,
        pnl,
        currency: t.currency,
      });

      lot.qty -= take;
      lot.fees -= buyFeeShare;
      remaining -= take;
      if (lot.qty <= 1e-9) lots[sym].shift();
    }
    // remaining > 0 means a sell with no matching buy on record — a short, or
    // more likely an incomplete import. Surfaced by the caller, not silently dropped.
    if (remaining > 1e-9) {
      closed.push({
        symbol: sym, quantity: remaining, buyPrice: null, sellPrice: price,
        openedAt: null, closedAt: t.traded_at, holdingDays: null,
        pnl: null, unmatched: true, currency: t.currency,
      });
    }
  }

  const openLots = {};
  for (const [sym, ls] of Object.entries(lots)) {
    const qty = ls.reduce((a, l) => a + l.qty, 0);
    if (qty <= 1e-9) continue;
    const cost = ls.reduce((a, l) => a + l.qty * l.price, 0);
    openLots[sym] = { quantity: qty, avgCost: cost / qty };
  }

  return { closed, openLots };
}

// ─── Trade journal ───────────────────────────────────────────────────────────

export async function addJournalEntry({
  symbol, thesis = null, emotion = null, planExit = null, planStop = null,
  tradeId = null, outcome = null, lesson = null,
}) {
  const r = await q(
    `INSERT INTO trade_journal (trade_id, symbol, thesis, emotion, plan_exit, plan_stop, outcome, lesson)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [tradeId, String(symbol).toUpperCase(), thesis, emotion, planExit, planStop, outcome, lesson],
  );
  return r ? r.rows[0] : null;
}

export async function closeJournalEntry(id, { outcome, lesson }) {
  const r = await q(
    `UPDATE trade_journal SET outcome = COALESCE($2, outcome), lesson = COALESCE($3, lesson),
     updated_at = now() WHERE id = $1 RETURNING *`,
    [id, outcome, lesson],
  );
  return r && r.rows.length ? r.rows[0] : null;
}

export async function listJournal({ symbol = null, limit = 20 } = {}) {
  const r = symbol
    ? await q("SELECT * FROM trade_journal WHERE symbol = $1 ORDER BY created_at DESC LIMIT $2",
              [String(symbol).toUpperCase(), limit])
    : await q("SELECT * FROM trade_journal ORDER BY created_at DESC LIMIT $1", [limit]);
  return r ? r.rows : [];
}

// ─── Trading discipline ──────────────────────────────────────────────────────

/**
 * The part a price feed cannot do.
 *
 * A hobby trader's results are driven far more by behaviour than by stock
 * selection, and the damaging patterns are invisible from inside. These
 * metrics are computed from Beverly's own recorded trades, so every flag can
 * be backed with her actual numbers rather than a generic warning.
 */
export async function tradingDiscipline({ days = 90 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const trades = await listTrades({ since, limit: 1000 });
  if (trades.length < 2) {
    return { enoughData: false, tradeCount: trades.length, flags: [], windowDays: days };
  }

  const { closed } = fifoRealised(trades);
  const matched = closed.filter((c) => !c.unmatched && c.pnl !== null);
  const wins = matched.filter((c) => c.pnl > 0);
  const losses = matched.filter((c) => c.pnl < 0);

  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const avg = (a) => (a.length ? sum(a) / a.length : 0);

  const grossWin = sum(wins.map((w) => w.pnl));
  const grossLoss = Math.abs(sum(losses.map((l) => l.pnl)));
  const avgWinHold = avg(wins.map((w) => w.holdingDays).filter((d) => d !== null));
  const avgLossHold = avg(losses.map((l) => l.holdingDays).filter((d) => d !== null));

  const metrics = {
    windowDays: days,
    tradeCount: trades.length,
    roundTrips: matched.length,
    winRate: matched.length ? (wins.length / matched.length) * 100 : null,
    avgWin: avg(wins.map((w) => w.pnl)),
    avgLoss: avg(losses.map((l) => l.pnl)),
    // Profit factor below 1 means the strategy loses money even if most trades win.
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null),
    netRealised: sum(matched.map((c) => c.pnl)),
    avgWinHoldDays: avgWinHold,
    avgLossHoldDays: avgLossHold,
    tradesPerWeek: (trades.length / days) * 7,
  };

  const flags = [];

  // Disposition effect: cutting winners early while nursing losers. One of the
  // most reliably costly retail patterns, and measurable straight from holding times.
  if (wins.length >= 3 && losses.length >= 3 && avgLossHold > avgWinHold * 1.5) {
    flags.push({
      code: "disposition_effect",
      severity: "high",
      detail: `Losers held ${avgLossHold.toFixed(0)} days on average, winners only ${avgWinHold.toFixed(0)}. `
            + `Selling winners early and holding losers is the most expensive habit in retail trading.`,
    });
  }

  // Winning often but still losing money — a sign of oversized losses.
  if (metrics.profitFactor !== null && metrics.profitFactor < 1 && metrics.winRate > 50) {
    flags.push({
      code: "asymmetric_losses",
      severity: "high",
      detail: `${metrics.winRate.toFixed(0)}% of round trips win, but the average loss `
            + `(${metrics.avgLoss.toFixed(0)}) outweighs the average win (${metrics.avgWin.toFixed(0)}). `
            + `Net realised is ${metrics.netRealised.toFixed(0)} over ${days} days.`,
    });
  }

  // Activity spike — overtrading usually follows a loss or a windfall.
  const last14 = trades.filter((t) => new Date(t.traded_at) > Date.now() - 14 * 86_400_000);
  const baselinePerWeek = ((trades.length - last14.length) / Math.max(days - 14, 1)) * 7;
  const recentPerWeek = (last14.length / 14) * 7;
  if (baselinePerWeek >= 1 && recentPerWeek > baselinePerWeek * 2.5) {
    flags.push({
      code: "activity_spike",
      severity: "medium",
      detail: `${recentPerWeek.toFixed(1)} trades/week over the last fortnight against a `
            + `${baselinePerWeek.toFixed(1)}/week baseline. Worth checking what changed.`,
    });
  }

  // Re-entering a name immediately after taking a loss on it.
  const revenge = [];
  for (const loss of losses) {
    const reentry = trades.find(
      (t) => t.symbol === loss.symbol
        && String(t.side).toLowerCase() === "buy"
        && new Date(t.traded_at) > new Date(loss.closedAt)
        && new Date(t.traded_at) - new Date(loss.closedAt) < 3 * 86_400_000,
    );
    if (reentry) revenge.push(loss.symbol);
  }
  if (revenge.length) {
    flags.push({
      code: "revenge_trading",
      severity: "medium",
      detail: `Re-entered ${[...new Set(revenge)].join(", ")} within three days of realising a loss on it.`,
    });
  }

  // Journal coverage — a thesis written before the outcome is the whole point.
  const journal = await listJournal({ limit: 200 });
  const journalled = new Set(journal.map((j) => j.symbol));
  const tradedSymbols = [...new Set(trades.map((t) => t.symbol))];
  const uncovered = tradedSymbols.filter((s) => !journalled.has(s));
  if (tradedSymbols.length >= 3 && uncovered.length > tradedSymbols.length / 2) {
    flags.push({
      code: "thin_journal",
      severity: "low",
      detail: `${uncovered.length} of ${tradedSymbols.length} traded names have no written thesis. `
            + `Without one there is nothing to review honestly afterwards.`,
    });
  }

  const noStop = journal.filter((j) => j.plan_stop === null).length;
  if (journal.length >= 4 && noStop > journal.length * 0.6) {
    flags.push({
      code: "no_exit_plan",
      severity: "medium",
      detail: `${noStop} of ${journal.length} journal entries set no stop or exit level in advance.`,
    });
  }

  return { enoughData: true, ...metrics, flags };
}

/** Concentration check across the whole book, trading and long-term alike. */
export function concentrationFlags(valued, { singleNameLimitPct = 20 } = {}) {
  const flags = [];
  for (const h of valued.holdings) {
    if (h.weightPct !== null && h.weightPct > singleNameLimitPct && h.asset_class !== "cash") {
      flags.push({
        code: "concentration",
        severity: h.weightPct > 35 ? "high" : "medium",
        detail: `${h.symbol} is ${h.weightPct.toFixed(1)}% of the portfolio.`,
      });
    }
  }
  return flags;
}

// ─── Watchlist ───────────────────────────────────────────────────────────────

export async function addToWatchlist({ symbol, note = null, alertAbove = null, alertBelow = null }) {
  const r = await q(
    `INSERT INTO watchlist (symbol, note, alert_above, alert_below)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (symbol) DO UPDATE SET
       note = COALESCE(EXCLUDED.note, watchlist.note),
       alert_above = EXCLUDED.alert_above,
       alert_below = EXCLUDED.alert_below
     RETURNING *`,
    [String(symbol).toUpperCase(), note, alertAbove, alertBelow],
  );
  return r ? r.rows[0] : null;
}

export async function removeFromWatchlist(symbol) {
  const r = await q("DELETE FROM watchlist WHERE symbol = $1 RETURNING symbol",
                    [String(symbol).toUpperCase()]);
  return Boolean(r && r.rowCount);
}

export async function listWatchlist() {
  const r = await q("SELECT * FROM watchlist ORDER BY symbol");
  return r ? r.rows : [];
}

/** Watchlist entries whose alert level has been crossed. Used by the proactive layer. */
export async function checkWatchlistAlerts() {
  const items = await listWatchlist();
  const hits = [];
  for (const w of items) {
    if (w.alert_above === null && w.alert_below === null) continue;
    const qt = await getQuote(w.symbol);
    if (!qt) continue;
    // Re-arm after 12h so a symbol sitting above its level doesn't alert hourly.
    if (w.last_alerted_at && Date.now() - new Date(w.last_alerted_at) < 12 * 3_600_000) continue;
    if (w.alert_above !== null && qt.price >= Number(w.alert_above)) {
      hits.push({ symbol: w.symbol, direction: "above", level: Number(w.alert_above), price: qt.price, note: w.note });
    } else if (w.alert_below !== null && qt.price <= Number(w.alert_below)) {
      hits.push({ symbol: w.symbol, direction: "below", level: Number(w.alert_below), price: qt.price, note: w.note });
    }
  }
  for (const h of hits) {
    await q("UPDATE watchlist SET last_alerted_at = now() WHERE symbol = $1", [h.symbol]);
  }
  return hits;
}

// ─── Trading 212 import (read only) ──────────────────────────────────────────

export function t212Enabled() {
  return Boolean(T212_API_KEY);
}

async function t212(path) {
  if (!T212_API_KEY) return null;
  try {
    const res = await fetch(T212_BASE + path, {
      headers: { Authorization: T212_API_KEY },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429) { console.error("[T212] rate limited"); return null; }
    if (!res.ok) { console.error(`[T212] ${path} HTTP ${res.status}`); return null; }
    return await res.json();
  } catch (err) {
    console.error(`[T212] ${path} ${err.name === "TimeoutError" ? "timeout" : err.message}`);
    return null;
  }
}

// T212 tickers look like AAPL_US_EQ / VWCE_EQ. Strip to the bare symbol.
function normaliseT212Ticker(ticker) {
  if (!ticker) return ticker;
  return String(ticker).split("_")[0].toUpperCase();
}

/**
 * Pull open positions from Trading 212 into holdings.
 *
 * Read-only: this reads the portfolio endpoint and writes to our own database.
 * It never sends anything to T212.
 */
export async function importFromT212({ account = "t212" } = {}) {
  if (!T212_API_KEY) return { ok: false, reason: "T212_API_KEY not set" };
  if (!dbAvailable()) return { ok: false, reason: "database unavailable" };

  const positions = await t212("/equity/portfolio");
  if (!Array.isArray(positions)) return { ok: false, reason: "could not read T212 portfolio" };

  let imported = 0;
  for (const p of positions) {
    const symbol = normaliseT212Ticker(p.ticker);
    if (!symbol || !p.quantity) continue;
    await upsertHolding({
      symbol,
      quantity: Number(p.quantity),
      avgCost: p.averagePrice !== undefined ? Number(p.averagePrice) : null,
      currency: p.currencyCode || BASE_CURRENCY,
      account,
      source: "t212",
    });
    imported++;
  }

  const cash = await t212("/equity/account/cash");
  if (cash && typeof cash.free === "number") {
    await upsertHolding({
      symbol: "CASH", name: "Cash", assetClass: "cash",
      quantity: cash.free, avgCost: 1,
      currency: cash.currencyCode || BASE_CURRENCY,
      account, source: "t212",
    });
  }

  return { ok: true, imported, cash: cash ? cash.free : null };
}

// ─── Statement / CSV import ──────────────────────────────────────────────────

/**
 * Parse a pasted broker statement or CSV into trades.
 *
 * Broker export formats vary wildly, so rather than maintain a parser per
 * broker, Hermes normalises the text into a fixed shape. Cheap, and this is
 * exactly the mechanical work the router exists for. Every row is validated
 * here afterwards — the model is used to reshape data, never to decide what
 * counts as valid.
 */
export async function importStatement(text, { account = "import" } = {}) {
  if (!dbAvailable()) return { ok: false, reason: "database unavailable" };

  const parsed = await extractJson(
    `Convert this broker statement or CSV into a JSON array of trades.

Each element: {"symbol","side","quantity","price","currency","fees","traded_at","external_id"}
- side must be exactly "buy" or "sell"
- quantity and price are positive numbers; strip thousands separators and currency symbols
- traded_at is ISO 8601 (YYYY-MM-DD or full timestamp)
- currency is a 3-letter code; default "EUR" if genuinely absent
- fees default 0
- external_id: the broker's own reference for the row if there is one, else null
- Ignore dividends, deposits, withdrawals, interest and fees-only rows. Trades only.
- If the text contains no trades, return []`,
    text,
  );

  if (!Array.isArray(parsed)) return { ok: false, reason: "could not parse the statement" };

  const results = { ok: true, inserted: 0, skipped: 0, rejected: [] };
  for (const row of parsed) {
    const symbol = row.symbol && String(row.symbol).toUpperCase().trim();
    const side = String(row.side || "").toLowerCase().trim();
    const quantity = Number(row.quantity);
    const price = Number(row.price);

    // Validate in code, not in the model. A hallucinated row must not reach
    // Beverly's records.
    if (!symbol || (side !== "buy" && side !== "sell")
        || !Number.isFinite(quantity) || quantity <= 0
        || !Number.isFinite(price) || price < 0) {
      results.rejected.push(row);
      continue;
    }

    const inserted = await recordTrade({
      symbol, side, quantity, price,
      currency: (row.currency || BASE_CURRENCY).toUpperCase().slice(0, 3),
      fees: Number.isFinite(Number(row.fees)) ? Number(row.fees) : 0,
      tradedAt: row.traded_at || null,
      account,
      source: "statement",
      externalId: row.external_id || null,
    });
    if (inserted) results.inserted++;
    else results.skipped++;   // duplicate external_id — re-import is idempotent
  }
  return results;
}
