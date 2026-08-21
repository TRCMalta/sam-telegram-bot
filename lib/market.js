/**
 * lib/market.js — market data for Beverly's portfolio and watchlist.
 *
 * Finnhub free tier: 60 calls/minute, which is ample for one person's holdings
 * and watchlist. Quotes are cached briefly because the proactive layer, the
 * portfolio valuation and a direct question can all ask for the same symbol
 * within seconds.
 *
 * Everything returns null rather than throwing. A missing price should show as
 * "price unavailable" next to the holding, never break the whole portfolio view.
 *
 * Config (env):
 *   FINNHUB_API_KEY   — https://finnhub.io, free signup
 *   QUOTE_CACHE_MS    — default 60000
 */
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE = "https://finnhub.io/api/v1";
const QUOTE_CACHE_MS = Number(process.env.QUOTE_CACHE_MS || 60_000);
const TIMEOUT_MS = 12_000;

const quoteCache = new Map(); // symbol -> { at, data }

export function marketEnabled() {
  return Boolean(FINNHUB_API_KEY);
}

async function finnhub(path, params = {}) {
  if (!FINNHUB_API_KEY) return null;
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("token", FINNHUB_API_KEY);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 429) {
      console.error("[MARKET] rate limited by Finnhub");
      return null;
    }
    if (!res.ok) {
      console.error(`[MARKET] ${path} HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[MARKET] ${path} ${err.name === "TimeoutError" ? "timeout" : err.message}`);
    return null;
  }
}

/**
 * Current quote. Returns { price, change, changePct, high, low, open, prevClose }
 * or null. Finnhub signals "unknown symbol" with an all-zero payload rather
 * than an error status, so treat a zero current price as no data.
 */
export async function getQuote(symbol) {
  const sym = String(symbol).toUpperCase().trim();
  const hit = quoteCache.get(sym);
  if (hit && Date.now() - hit.at < QUOTE_CACHE_MS) return hit.data;

  const j = await finnhub("/quote", { symbol: sym });
  if (!j || typeof j.c !== "number" || j.c === 0) return null;

  const data = {
    symbol: sym,
    price: j.c,
    change: j.d,
    changePct: j.dp,
    high: j.h,
    low: j.l,
    open: j.o,
    prevClose: j.pc,
  };
  quoteCache.set(sym, { at: Date.now(), data });
  return data;
}

export async function getQuotes(symbols) {
  const out = {};
  // Sequential with a small gap: 60/min is generous but a burst of 30 parallel
  // requests can still trip the limiter, and a rate-limited portfolio view is
  // worse than a slightly slower one.
  for (const s of symbols) {
    out[s] = await getQuote(s);
  }
  return out;
}

export async function getProfile(symbol) {
  const j = await finnhub("/stock/profile2", { symbol: String(symbol).toUpperCase() });
  if (!j || !j.name) return null;
  return {
    symbol: j.ticker,
    name: j.name,
    country: j.country,
    currency: j.currency,
    exchange: j.exchange,
    industry: j.finnhubIndustry,
    marketCap: j.marketCapitalization,
    website: j.weburl,
  };
}

export async function searchSymbol(query) {
  const j = await finnhub("/search", { q: query });
  if (!j || !Array.isArray(j.result)) return [];
  return j.result.slice(0, 8).map((r) => ({
    symbol: r.symbol,
    description: r.description,
    type: r.type,
  }));
}

export async function getCompanyNews(symbol, days = 7) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const j = await finnhub("/company-news", {
    symbol: String(symbol).toUpperCase(),
    from: iso(from),
    to: iso(to),
  });
  if (!Array.isArray(j)) return [];
  return j.slice(0, 6).map((n) => ({
    headline: n.headline,
    source: n.source,
    url: n.url,
    at: n.datetime ? new Date(n.datetime * 1000).toISOString() : null,
  }));
}

/**
 * FX conversion into the portfolio's base currency.
 *
 * Beverly is a euro investor holding mostly USD-denominated instruments, so
 * without this the portfolio total is meaningless. Rates are cached for an
 * hour — intraday FX drift is irrelevant next to the equity moves underneath.
 */
let fxCache = { at: 0, base: null, rates: null };

export async function getFxRates(base = "EUR") {
  if (fxCache.rates && fxCache.base === base && Date.now() - fxCache.at < 3_600_000) {
    return fxCache.rates;
  }
  const j = await finnhub("/forex/rates", { base });
  if (!j || !j.quote) return null;
  fxCache = { at: Date.now(), base, rates: j.quote };
  return j.quote;
}

/**
 * Convert an amount into `base`. Returns null when the rate is unknown, so
 * callers can show the native figure and flag it rather than invent a number.
 */
export async function convert(amount, from, base = "EUR") {
  if (!from || from === base) return amount;
  const rates = await getFxRates(base);
  if (!rates) return null;
  // Finnhub returns units of <currency> per 1 <base>, so divide to come back.
  const rate = rates[from];
  if (!rate || rate === 0) return null;
  return amount / rate;
}
