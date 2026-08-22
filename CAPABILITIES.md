# Sam — capabilities and configuration

Sam is Beverly Cutajar's AI chief of staff. Node/Express service on Railway
(project `cheerful-connection`, service `sam-telegram-bot`), reaching Beverly on
**Telegram and WhatsApp**, with voice replies.

Everything added here **degrades safely**. With none of the new environment
variables set, Sam boots and behaves exactly as he did before. Each key switches
one capability on. `GET /healthz/capabilities` reports what is live.

---

## What Sam can do

| Area | Capability | Needs |
|---|---|---|
| **Think Talent** | Odoo CRM — leads, deals, products, contacts, events, invoices, sales orders, tags, notes | `ODOO_*` |
| **Ceek Talent** | Firefish — pipeline, jobs, candidates, placements, companies | `FIREFISH_*` |
| **Beverly's desk** | Read email, send email, read calendar, create events | `MS_*` |
| **Research** | Web search, browse a URL, company lookup, competitor intel | `BRAVE_API_KEY` |
| **Memory** | Conversation history that survives a redeploy; rolling summary of older turns | `DATABASE_URL` |
| **Commitments** | Log, recall, chase and close commitments, decisions and follow-ups | `DATABASE_URL` |
| **Relationships** | Track contact cadence, flag people who have gone quiet | `DATABASE_URL` |
| **Investing** | Portfolio valuation, allocation, concentration warnings, bonds with coupons and maturities | `DATABASE_URL` + `FINNHUB_API_KEY` |
| **Trading** | Trade log, FIFO realised P&L, trade journal, watchlist with price alerts | `DATABASE_URL` + `FINNHUB_API_KEY` |
| **Discipline** | Disposition effect, asymmetric losses, activity spikes, re-entry after a loss, journal coverage | `DATABASE_URL` |
| **Projections** | Compounding maths across multiple horizons, real and nominal, net of fees | nothing — pure maths |
| **Cost control** | Route internal work to Hermes, scope tools and prompt per message | `OPENROUTER_API_KEY` |

### What Sam deliberately cannot do

**Sam cannot place, modify or cancel a trade.** There is no order-placement path
anywhere in the code and there must never be one. He records, values, analyses
and coaches; Beverly executes in her own broker. The Trading 212 integration is
read-only.

Per TRC's standing rule for personal finance, Sam's financial output is
**analysis and information, never regulated advice**. Anything turning on
Beverly's tax position, risk capacity or a large irreversible decision gets
pointed at a licensed adviser.

---

## Configuration

### Required (already set)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `TELEGRAM_TOKEN` / `WA_ACCESS_TOKEN` | at least one channel |
| `BEVERLY_WA_NUMBER` | where proactive messages go |

### Durable memory — the important one

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres. Railway provides this when you add a Postgres service. |
| `PGSSL` | `off` for `*.railway.internal` URLs (detected automatically) |

**To provision:**

1. Railway → project `cheerful-connection` → **New** → **Database** → **PostgreSQL**.
2. Railway puts `DATABASE_URL` on the *Postgres service*, not on Sam. Open the
   **sam-telegram-bot** service → **Variables** → add:
   `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   (substitute the actual Postgres service name if Railway named it differently).
   That reference resolves to the internal `*.railway.internal` host, which
   costs no egress and needs no TLS — `sslConfig()` detects it automatically.
3. Redeploy. Sam creates its own schema on boot and logs `[DB] schema ready`.

Step 2 is easy to miss: adding the database alone does nothing until Sam is
given the reference.

Until this exists Sam forgets Beverly on every redeploy, and open items,
portfolio and journal tools all report storage unavailable.

### Token routing (Hermes via OpenRouter)

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | — | enables routing; absent = everything on Claude |
| `HERMES_MODEL` | `nousresearch/hermes-4-70b` | classification, condensing, summarising |
| `HERMES_HEAVY_MODEL` | `nousresearch/hermes-4-405b` | statement parsing |
| `HERMES_TIMEOUT_MS` | `20000` | |

Hermes 4 70B is roughly 23× cheaper per input token than Claude Sonnet and
handles only work Beverly never reads. Her replies stay on Claude.

### Market data and broker

| Variable | Purpose |
|---|---|
| `FINNHUB_API_KEY` | quotes, profiles, news, FX. Free tier, 60 calls/min — https://finnhub.io |
| `T212_API_KEY` | Trading 212 **read** key, for importing positions |
| `T212_ENV` | `live` (default) or `demo` |
| `BASE_CURRENCY` | default `EUR` |

### Proactive delivery — the WhatsApp 24-hour window

Meta's WhatsApp Business API rejects free-form messages sent more than 24
hours after the recipient's last inbound message (error `131047`). Every
proactive message Sam sends is free-form, so **a briefing to a Beverly who
went quiet yesterday is refused** — and she cannot tell "Sam had nothing to
say" apart from "Sam's message was rejected".

What Sam does about it:

1. Rejected proactive sends now **alert the admin Telegram chat** with the
   cause, instead of dying in a console line.
2. If `BEVERLY_TG_CHAT_ID` is set, the message is **delivered to Beverly on
   Telegram instead**, so she gets it either way.
3. The proper fix is a **Meta-approved template message** (created in Meta
   Business Manager) — e.g. "Good morning Beverly — your briefing is ready" —
   whose reply reopens the 24-hour window. That is an account task, not code;
   until it exists, keep `BEVERLY_TG_CHAT_ID` set.

| Variable | Purpose |
|---|---|
| `BEVERLY_TG_CHAT_ID` | Beverly's Telegram chat id — proactive fallback route |

### Proactive schedule (all optional)

| Variable | Default | |
|---|---|---|
| `MORNING_HOUR_MALTA` | `7` | morning briefing |
| `WEEKLY_DEBRIEF_DAY` / `_HOUR` | `Fri` / `16` | end-of-week close-out |
| `CHASE_HOUR` | `12` | overdue commitments |
| `STALE_DAY` / `STALE_HOUR` | `Mon` / `9` | relationships gone quiet |
| `MEETING_PREP_MINS` | `30` | prep note ahead of a calendar event |
| `WATCHLIST_ALERTS` | `on` | `off` to silence price alerts |

### Memory tuning

| Variable | Default | |
|---|---|---|
| `MEMORY_LIVE_TURNS` | `24` | turns replayed verbatim |
| `MEMORY_COMPRESS_AFTER` | `40` | un-summarised turns before compression |

---

## Token routing, measured

Before: the full system prompt (~4.1K tokens) plus all tool schemas (~4.1K)
went on **every** Claude call, re-sent on each iteration of the tool-use loop —
an ~8,190-token floor, so a three-round message cost ~33K input tokens before
history.

After, with 43 tools available but scoped per message:

| Message type | Floor | Change |
|---|---|---|
| Smalltalk | ~1,140 | −86% |
| Web / research | ~1,910 | −77% |
| Commitments | ~2,170 | −74% |
| Email / diary | ~2,550 | −69% |
| Ceek recruitment | ~2,800 | −66% |
| Personal finance | ~3,970 | −51% |
| Think Talent | ~5,730 | −30% |

Think Talent stays highest because the Malta funding-scheme rules (~1.5K tokens)
are genuinely needed there — and are now excluded from every other message.

Routing order: Hermes classifies → free keyword pass if Hermes is unavailable →
widen to the last exchange for short follow-ups → full tool set if still unclear.

---

## Health

- `GET /healthz/deep` — upstream checks. Storage counts as critical **once
  configured**, so a Sam that silently stopped remembering reports degraded.
- `GET /healthz/capabilities` — what is live, what is off for want of a key.

Both honour `HEALTH_TOKEN` if set.

---

## Tests

```
npm test                  # projections (18), FIFO (20), routing (23) — no deps
npm run test:integration  # 41 checks against a real Postgres
npm run test:smoke        # boots the real server, both modes
npm run test:all          # everything
```

The integration and smoke suites need a database:

```
DATABASE_URL=postgres://... PGSSL=off npm run test:all
```

**CI** runs all three on every push and PR (`.github/workflows/ci.yml`), on
Node 18 to match the Dockerfile, with a `postgres:16` service container. No
secrets are used — the tests exercise pure functions, a throwaway database, and
a server started with placeholder credentials. Nothing reaches a live upstream.

The smoke test is the guard on the "everything is optional" promise: it boots
the real server with nothing configured, proves it still serves traffic, and
asserts `tradeExecution: false` in every configuration.

The projection maths is verified against a brute-force month-by-month
simulation, and FIFO cost-basis against hand-computed round trips, because both
produce numbers Beverly may act on.

### A note on the compounding convention

Projections treat a quoted return as the **effective annual** rate (monthly rate
= `(1+r)^(1/12) − 1`). Many online calculators instead use `r/12`, which quietly
turns a stated 7% into an effective 7.23% and inflates a 30-year result by about
4%. If a figure looks low against a web calculator, this is why. Ours is the
faithful reading of "the S&P 500 returned 8% a year", and the more conservative.
