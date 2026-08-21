---
name: ai-chief-of-staff
description: >-
  Builds and operates AI chiefs of staff for TRC principals. Use aggressively
  whenever the user wants to create, configure, update, extend or debug an AI
  chief of staff for anyone in TRC leadership (Beverly, Jonathan, or a new
  principal). Also trigger on Sam, AI executive assistants, proactive AI
  coaching, morning briefings, weekly debriefs, decision support, meeting prep,
  open item tracking, relationship management, pipeline briefings, personal
  portfolio or trading support for a principal, or any task involving an AI
  agent that acts as a right hand to a business leader. Trigger on "chief of
  staff", "Sam", "AI assistant for [person]", "build an agent for [role]",
  "proactive coaching", "morning briefing", "weekly debrief", "executive AI",
  or any task about an AI agent supporting a leader's daily workflow.
---

# AI Chief of Staff — TRC

Build and operate AI chiefs of staff for TRC leadership. Each deployment serves
one **principal**.

> **Corrected 2026-08-21.** The previous version of this skill described Sam as
> an n8n Cloud workflow delivered over WhatsApp, and pointed at four
> `references/*.md` files that did not exist. Both were wrong. Sam is a Node
> service on Railway serving Telegram **and** WhatsApp. What follows reflects
> the deployed system.

---

## Existing deployments

| Principal | Agent | Platform | Channels | Repo |
|---|---|---|---|---|
| Beverly Cutajar (COO) | **Sam** | Railway `cheerful-connection` / `sam-telegram-bot` | Telegram + WhatsApp, with voice | `TRCMalta/sam-telegram-bot` |
| Jonathan Cremona | Atlas | Railway `blissful-forgiveness` | Telegram | vault-driven |

Other TRC bots that are **not** chiefs of staff: Kim (Think Talent WhatsApp),
Milo (Ceek recruitment intake), Barry (Jonathan's personal LinkedIn), Bruce
(brand/social content), Don, Barbara, Zaz.

---

## Sam's architecture

Single Node/Express service, `server.js` plus `lib/` modules, Claude via the
Anthropic SDK.

```
Telegram / WhatsApp webhook
  → classify domains (Hermes, with a free keyword fallback)
  → scoped system prompt + scoped tool subset
  → Claude tool-use loop (large tool results condensed by Hermes)
  → reply, persist turns, compress older turns in the background
```

| Module | Responsibility |
|---|---|
| `lib/db.js` | Postgres pool, schema migration on boot, in-memory fallback |
| `lib/llm.js` | Hermes routing via OpenRouter + keyword classifier |
| `lib/memory.js` | Durable conversation history, rolling summary |
| `lib/openitems.js` | Commitments, decisions, relationships |
| `lib/finance.js` | Holdings, trades, FIFO P&L, journal, discipline analytics |
| `lib/market.js` | Finnhub quotes, news, FX |
| `lib/projections.js` | Deterministic compounding maths |
| `lib/proactive.js` | Scheduled briefings, chases, alerts |
| `lib/voice.js` | Groq TTS → OGG/Opus for WhatsApp voice notes |

Full configuration and env-var reference: **`CAPABILITIES.md`** in the repo
root. Do not duplicate it here — that file is the source of truth.

---

## Principles

**Memory is the whole thing.** A chief of staff who forgets is a chatbot. Sam
persists to Postgres and folds older turns into a rolling summary. Anything that
would delete a principal's history is a bug, not a cleanup — the context-overflow
path shrinks the replayed window and keeps the record.

**Proactive beats reactive.** The valuable message is the one the principal
didn't ask for. Sam runs a morning briefing, a Friday debrief, overdue chases,
stale-relationship checks, meeting prep and watchlist alerts. Dedupe keys live
in Postgres so a redeploy cannot double-send.

**Build the digest in code, let the model write it.** Every proactive message is
assembled deterministically, then handed to Claude once to phrase. No model
counts anything.

**Confirmation gates protect trust.** No irreversible action without explicit
approval. Email is drafted, shown, and only sent after the principal says so.
One mistake here costs months of trust.

**Cheap model for machinery, good model for voice.** Classification, condensing,
summarising and parsing go to Hermes. Anything the principal reads stays on
Claude. Fail soft — a router outage must cost tokens, never a reply.

**Degrade, never fail.** Every integration is optional. Missing config disables
a capability and says so; it never breaks the service.

---

## Personal finance for a principal

Sam supports Beverly's investing and her trading hobby. If you extend this, or
build it for another principal, these are not negotiable:

1. **No execution path. Ever.** Sam records, values, analyses and coaches. The
   principal places their own orders. Broker integrations are read-only.
2. **Analysis, not advice.** TRC's standing rule (see the `investments-context`
   skill): frame outputs as information; flag when a licensed adviser is needed.
   Under MiFID II, personalised recommendations are regulated territory.
3. **Never let the model do the arithmetic.** Compounding, P&L and valuations
   run through deterministic code. An LLM's 40-year projection will be subtly
   wrong and the principal may act on it.
4. **Ranges, not point forecasts.** Always a scenario band, always the
   inflation-adjusted figure alongside the nominal, always net of fees.
5. **Validate model-parsed data in code.** Hermes reshapes broker statements;
   code decides what is a valid row. A hallucinated trade must never reach the
   records.

Two modes, deliberately opposite. **Trading:** enforce discipline — thesis
written before the outcome, patterns surfaced from the principal's own numbers.
**Long-term:** help them do nothing — allocation, benchmark, coupons, and
discouragement from reacting to noise.

---

## Creating a chief of staff for a new principal

1. **Profile the principal** — role, decision domains, daily tools, comms
   preferences, timezone (default Europe/Malta).
2. **Fork Sam.** He is the reference implementation. Adapt the persona block in
   `buildSystemPrompt`, then the tool set.
3. **Scope the tools to the role.** A Chairman needs network and strategy; a COO
   needs execution and bottlenecks. Group them by domain in `TOOL_DOMAIN` so
   routing keeps working.
4. **Set the cadence.** Pick proactive moments that suit the role rather than
   copying Sam's wholesale.
5. **Provision Postgres first.** Without it there is no memory and half the
   tools report unavailable.
6. **Verify with `/healthz/capabilities`** before telling anyone it's live.

## Changing a deployed chief of staff

1. Identify the module (see the table above) — not everything is in `server.js`.
2. Run `npm test` before pushing. The maths and routing suites are fast and
   catch the errors that matter.
3. Test both boot paths: with and without `DATABASE_URL`.
4. Check `/healthz/capabilities` after deploy.
