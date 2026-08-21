# Railway Deployment

This repo (Sam) deploys to Railway project **cheerful-connection** (service: sam-telegram-bot).

Despite the service name, Sam serves **both Telegram and WhatsApp** (with voice
replies on WhatsApp).

## Required addition: Postgres

Sam now needs a Postgres service in `cheerful-connection` for durable memory,
open items, and Beverly's portfolio and trade journal. Add it via **New →
Database → PostgreSQL**; Railway injects `DATABASE_URL` and Sam creates its own
schema on boot.

Without it Sam still runs, but forgets everything on each redeploy and the
memory, portfolio and journal tools report storage unavailable. See
`CAPABILITIES.md` for the full environment reference.

## Full Railway map (TRC, audited 2026-06-29)

| Railway project | Service(s) | Agent / purpose |
|---|---|---|
| spirited-healing | web + 4×Postgres | Kim — Think Talent WhatsApp bot |
| cheerful-connection | sam-telegram-bot (+ Postgres) | Sam — Beverly's chief of staff, Telegram + WhatsApp |
| don-cos | don-telegram-bot | Don — Telegram bot |
| feisty-vision | milo-api, gordon, function-bun | Milo — Ceek recruitment intake |
| barry | barry-app | Barry — TRC CMO LinkedIn agent |
| blissful-forgiveness | trc-bruce, atlas, trc-atlas, barbara-bot, zaz-telegram-bot | Shared infra box: Bruce + Atlas + Barbara + Zaz |
| agile-intuition | firefish-mcp | Firefish MCP server |
| terrific-vitality | firefish-phase-b, Postgres, Redis | Firefish phase-B |
| lucid-adventure | odoo-mcp | Odoo MCP server |
| synthesia-mcp | synthesia-mcp | Synthesia MCP server |
| ceek-runner | ceek-runner | Ceek CV→password runner |
| captivating-spirit | (empty) | unused leftover |

**Gotcha:** `blissful-forgiveness` is multi-service (Bruce, Atlas, Barbara, Zaz colocated) — not one-project-per-bot. Re-audit with `railway list` then `railway status --json` in each linked dir.
