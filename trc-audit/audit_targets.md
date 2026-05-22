---
type: targets-list
governor: Jonathan
last_updated: 2026-05-22
review_cycle: monthly
---

# Audit Targets — the monthly checklist

> **The Governor edits this file.** Judge Dredd reads it on every monthly invocation and walks every item below. Anything not listed here is not audited. **Alfred / Polymarket is permanently excluded — do not add it.**

## How to edit

- Add a row when a new project / repo / agent / job / dataset / integration goes live.
- Move a row to the **Retired** section when it is shut down — do not delete; the audit team needs the historical record.
- Edit the **Last reviewed** date when Judge Dredd has completed an inspection.

---

## 1. Git repositories

| # | Repository | Description | Where to read it | Last reviewed |
|---|---|---|---|---|
| 1 | `TRCMalta/sam-telegram-bot` | Sam — Beverly's AI Chief of Staff (Telegram + WhatsApp). | GitHub | 2026-05-22 |
| 2 | _add the next repo here_ | | | |

## 2. Non-repo projects

_Things that exist as BI dashboards, low-code workflows, or hosted documents — not in git._

| # | Project | Tooling | Description | Owner | Last reviewed |
|---|---|---|---|---|---|
| 1 | _add the first non-repo project_ | e.g. Looker / Power BI / Coupler.io / Google Sheets / Zapier / Make | One-sentence description | Name | — |

## 3. AI agents and chatbots

_Every AI system TRC operates, beyond Sam._

| # | Agent | Purpose | Hosted on | Personal data touched? | Last reviewed |
|---|---|---|---|---|---|
| 1 | Sam | AI Chief of Staff for Beverly | Railway | Yes — mailbox, HR, candidates | 2026-05-22 |
| 2 | Judge Dredd | This audit agent | Claude Code subagent (local) | No | 2026-05-22 |
| 3 | _add the next agent_ | | | | |

## 4. Scheduled jobs and pipelines

_Cron jobs, GitHub Actions, Coupler.io dataflows, scheduled reports._

| # | Job | What it does | Cadence | Where it runs | Personal data? | Last reviewed |
|---|---|---|---|---|---|---|
| 1 | _add the first job_ | | | | | |

## 5. Datasets

_Persistent data stores TRC reads or writes._

| # | Dataset | Where it lives | Who controls it | Sensitivity | Last reviewed |
|---|---|---|---|---|---|
| 1 | Beverly's Outlook mailbox | Microsoft 365 (TRC tenant) | TRC | confidential | 2026-05-22 |
| 2 | Firefish candidate pipeline | Firefish UK | Think Talent / TRC | personal data | 2026-05-22 |
| 3 | Odoo CRM / HR / accounting | self-hosted thinktalent.com.mt | Think Talent | confidential | 2026-05-22 |
| 4 | _add the next dataset_ | | | | |

## 6. Integrations

_Third-party tools TRC's projects call into._

| # | Tool | Used by | Billing owner | Last reviewed |
|---|---|---|---|---|
| 1 | Railway | Sam | TBD | 2026-05-22 |
| 2 | Anthropic / Claude | Sam, Judge Dredd | TBD | 2026-05-22 |
| 3 | Microsoft Graph | Sam | TRC M365 tenant | 2026-05-22 |
| 4 | Telegram Bot API | Sam | n/a (free) | 2026-05-22 |
| 5 | WhatsApp Cloud API | Sam | TBD | 2026-05-22 |
| 6 | Firefish | Sam | Think Talent | 2026-05-22 |
| 7 | Odoo | Sam | Think Talent | 2026-05-22 |
| 8 | _add the next integration_ | | | |

---

## Retired

_Move rows here when a project is shut down. Judge Dredd preserves the historical record._

| # | Item | Retired on | Reason |
|---|---|---|---|

---

## Excluded — out of scope by Governor's standing instruction

| Item | Reason |
|---|---|
| Alfred (Polymarket bot) | Out of scope by Governor's standing instruction. Never audited. |
