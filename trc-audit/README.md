# TRC Audit — Standalone Compliance Project

> **This folder is the standalone audit programme for The Remarkable Collective.** It is currently parked inside `sam-telegram-bot` only because that is the branch this development session was scoped to. **Lift it out into its own repository** (suggested name: `trc-audit`) — see `MIGRATION.md` — and from then on the audit lives separately from Sam, Alfred, and every other TRC project.

## What lives here

```
trc-audit/
├── .claude/
│   └── agents/
│       └── judge-dredd.md     ← the Claude Code subagent the Governor invokes
├── Audit Vault/               ← the Obsidian vault the audit team reads
│   ├── README.md
│   ├── Master Audit.md
│   ├── Compliance Posture.md
│   ├── Open Questions.md
│   ├── Change Log.md
│   ├── Dashboard.html         ← gamified dashboard (open in any browser)
│   ├── TRC-Audit.docx         ← Word document for the audit team
│   ├── Projects/  Agents/  Jobs/  Datasets/  Integrations/  Concepts/
│   ├── Compliance/01..09/     ← ROPA, AISR, DPIA, Transfers, DPAs, DSR, Incidents, Policies, Notices
│   └── scripts/               ← regenerate Dashboard.html and TRC-Audit.docx
├── audit_targets.md           ← the Governor's list of projects / repos / agents to audit each month
├── MONTHLY-RUNBOOK.md         ← step-by-step for the Governor's monthly check
├── MIGRATION.md               ← how to extract this into a standalone repo
└── README.md                  ← this file
```

## How it runs

1. **Once a month**, the Governor (Jonathan, `jonathan@theremarkablecollective.com`) opens a Claude Code session pointed at this folder (after migration, at the root of the `trc-audit` repo).
2. The Governor types: `/agent judge-dredd Run the monthly check.`
3. Judge Dredd reads `audit_targets.md`, walks each listed project / repo / non-repo system / AI agent, and updates the vault accordingly.
4. Judge Dredd appends to `Audit Vault/Change Log.md`, carries forward `Open Questions.md`, regenerates `Dashboard.html` and `TRC-Audit.docx`.
5. The Governor reviews and either approves or asks for changes.

## Scope discipline

- **In scope:** every TRC project, AI agent, scheduled job, dataset, and third-party integration listed in `audit_targets.md`.
- **Out of scope — never audited:** **Alfred (TRC's Polymarket bot)**. Judge Dredd skips every reference to Alfred or Polymarket by design.

## Jurisdiction

TRC is established in **Malta**, so the audit programme is built around EU law:

- **GDPR** (Regulation 2016/679) — already in force.
- **EU AI Act** (Regulation 2024/1689) — Article 4 in force since 2 Feb 2025; the bulk of operator obligations including Article 26 and Article 50 apply from **2 August 2026**.
- **Maltese Data Protection Act**, enforced by the **Information and Data Protection Commissioner of Malta (IDPC)**.

## Next step for the Governor

Read `MIGRATION.md` and move this folder into a new repo `TRCMalta/trc-audit`. The audit then truly stands alone.
