/**
 * scripts/verify-keys.mjs — check the optional API keys actually work.
 *
 * Both of Sam's optional upstreams fail SOFT by design: a bad OpenRouter key
 * means every request quietly falls back to Claude (higher bill, no error), and
 * a bad Finnhub key means portfolio valuation silently reports "no price
 * available". Neither shows up as a crash, so a wrong key can sit unnoticed
 * for weeks. This makes that failure loud.
 *
 * Checks the OpenRouter key AND that the configured Hermes model id is real —
 * a mistyped model id is the likeliest misconfiguration and has exactly the
 * same silent symptom.
 *
 * Never prints a key. Reads them from the environment only.
 *
 * Usage:
 *   OPENROUTER_API_KEY=... FINNHUB_API_KEY=... node scripts/verify-keys.mjs
 *
 * Or against a local .env (which is gitignored):
 *   node --env-file=.env scripts/verify-keys.mjs
 */
const HERMES_MODEL = process.env.HERMES_MODEL || "nousresearch/hermes-4-70b";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const T212_API_KEY = process.env.T212_API_KEY;

let failures = 0;
// A corporate/sandbox egress proxy returns 403 on a blocked host, which looks
// identical to an upstream auth failure. Say so rather than send someone off
// rotating a key that was never the problem.
const BEHIND_PROXY = Boolean(process.env.HTTPS_PROXY || process.env.https_proxy);
const proxyHint = (host) =>
  BEHIND_PROXY
    ? `        note: HTTPS_PROXY is set — a 403 here may be the proxy blocking ${host}, not the key.`
    : null;
const maybeProxyNote = (host) => { const n = proxyHint(host); if (n) console.log(n); };
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const skip = (m) => console.log(`  SKIP  ${m}`);
// Show enough to tell two keys apart, never enough to use one.
const fingerprint = (k) => `${k.slice(0, 6)}…${k.slice(-4)} (${k.length} chars)`;

// ─── OpenRouter ──────────────────────────────────────────────────────────────
console.log("\nOpenRouter (Hermes routing)");
if (!OPENROUTER_API_KEY) {
  skip("OPENROUTER_API_KEY not set — Sam runs everything on Claude, which works but costs more");
} else {
  console.log(`  key: ${fingerprint(OPENROUTER_API_KEY)}`);
  try {
    const auth = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (auth.status === 401) {
      fail("key rejected (401) — wrong or revoked");
    } else if (!auth.ok) {
      fail(`auth check returned HTTP ${auth.status}`);
      if (auth.status === 403) maybeProxyNote("openrouter.ai");
    } else {
      const d = (await auth.json()).data || {};
      pass("key accepted");
      if (d.limit_remaining !== undefined && d.limit_remaining !== null) {
        console.log(`        credit remaining: ${d.limit_remaining}`);
        if (Number(d.limit_remaining) <= 0) fail("no credit remaining — routing will fail back to Claude");
      } else if (d.usage !== undefined) {
        console.log(`        usage to date: ${d.usage}`);
      }
      if (d.is_free_tier) console.log("        free tier — rate limits are tight");
    }
  } catch (err) {
    fail(`auth check failed: ${err.name === "TimeoutError" ? "timeout" : err.message}`);
  }

  // The model id matters as much as the key.
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://trc.com.mt",
        "X-Title": "Sam - key verification",
      },
      body: JSON.stringify({
        model: HERMES_MODEL,
        messages: [{ role: "user", content: "Reply with the single word: pong" }],
        max_tokens: 8,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const body = await res.text();
      fail(`model "${HERMES_MODEL}" rejected (HTTP ${res.status})`);
      console.log(`        ${body.slice(0, 300)}`);
      console.log(`        Check the id at https://openrouter.ai/models, then set HERMES_MODEL.`);
    } else {
      const j = await res.json();
      const text = j?.choices?.[0]?.message?.content?.trim();
      if (!text) fail(`model "${HERMES_MODEL}" returned an empty completion`);
      else {
        pass(`model "${HERMES_MODEL}" answered: "${text.slice(0, 40)}"`);
        if (j.usage) console.log(`        tokens in/out: ${j.usage.prompt_tokens}/${j.usage.completion_tokens}`);
      }
    }
  } catch (err) {
    fail(`completion failed: ${err.name === "TimeoutError" ? "timeout" : err.message}`);
  }
}

// ─── Finnhub ─────────────────────────────────────────────────────────────────
console.log("\nFinnhub (market data)");
if (!FINNHUB_API_KEY) {
  skip("FINNHUB_API_KEY not set — no quotes, no portfolio valuation, no price alerts");
} else {
  console.log(`  key: ${fingerprint(FINNHUB_API_KEY)}`);
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(FINNHUB_API_KEY)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (res.status === 401 || res.status === 403) {
      fail(`key rejected (HTTP ${res.status})`);
      if (res.status === 403) maybeProxyNote("finnhub.io");
    } else if (res.status === 429) {
      fail("rate limited (429) — the key works but is over its limit right now");
    } else if (!res.ok) {
      fail(`HTTP ${res.status}`);
    } else {
      const q = await res.json();
      // Finnhub answers an unknown or unauthorised symbol with all zeros
      // rather than an error status, so zero means failure, not data.
      if (!q || typeof q.c !== "number" || q.c === 0) {
        fail("returned an all-zero quote — key likely unauthorised for this endpoint");
      } else {
        pass(`live quote: AAPL ${q.c} (${q.dp >= 0 ? "+" : ""}${(q.dp ?? 0).toFixed(2)}% today)`);
      }
    }
  } catch (err) {
    fail(`quote failed: ${err.name === "TimeoutError" ? "timeout" : err.message}`);
  }

  // FX matters: Beverly is a euro investor holding mostly USD instruments, so
  // without a rate the portfolio total is meaningless rather than merely wrong.
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/forex/rates?base=EUR&token=${encodeURIComponent(FINNHUB_API_KEY)}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (res.ok) {
      const j = await res.json();
      if (j?.quote?.USD) pass(`FX available: 1 EUR = ${Number(j.quote.USD).toFixed(4)} USD`);
      else fail("FX endpoint returned no rates — portfolio totals will show native currency only");
    } else if (res.status === 403) {
      fail("FX endpoint not included on this plan (403) — portfolio totals will show native currency only");
    } else {
      fail(`FX endpoint HTTP ${res.status}`);
    }
  } catch (err) {
    fail(`FX check failed: ${err.name === "TimeoutError" ? "timeout" : err.message}`);
  }
}

// ─── Trading 212 (optional, read only) ───────────────────────────────────────
console.log("\nTrading 212 (optional, read-only position import)");
if (!T212_API_KEY) {
  skip("T212_API_KEY not set — Beverly's holdings come from chat or a pasted statement instead");
} else {
  const base = (process.env.T212_ENV || "live") === "demo"
    ? "https://demo.trading212.com/api/v0" : "https://live.trading212.com/api/v0";
  try {
    const res = await fetch(`${base}/equity/account/cash`, {
      headers: { Authorization: T212_API_KEY },
      signal: AbortSignal.timeout(25_000),
    });
    if (res.status === 401 || res.status === 403) fail(`key rejected (HTTP ${res.status})`);
    else if (res.status === 429) fail("rate limited (429) — T212 limits are strict; retry in a minute");
    else if (!res.ok) fail(`HTTP ${res.status}`);
    else {
      const j = await res.json();
      pass(`account reachable (free cash ${j.free ?? "?"} ${j.currencyCode ?? ""})`);
    }
  } catch (err) {
    fail(`account check failed: ${err.name === "TimeoutError" ? "timeout" : err.message}`);
  }
}

console.log(
  failures === 0
    ? "\nAll configured keys verified.\n"
    : `\n${failures} problem(s) found. Sam will still run — these upstreams fail soft — but the affected capability is off.\n`,
);
process.exit(failures === 0 ? 0 : 1);
