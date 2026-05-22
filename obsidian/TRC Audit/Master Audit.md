---
type: master
governor: Jonathan
last_updated: 2026-05-22
auditor: Judge Dredd
jurisdiction: EU (Malta)
applicable_law: ["GDPR", "EU AI Act", "Maltese Data Protection Act"]
---

# TRC Master Audit

> **Source of truth.** Rewritten by [[Judge Dredd]] on every refresh. Humans only edit [[Open Questions]]. **[[Alfred]] / Polymarket is out of scope and never appears here.**

See [[Compliance Posture]] for the single-page status report. See [[README]] for how this vault is structured.

## 1. Governance

- **Governor:** Jonathan ([jonathan@theremarkablecollective.com](mailto:jonathan@theremarkablecollective.com)) — owns this audit programme and is the sole sign-off authority.
- **Data Controller:** [[TRC]] — Jonathan signs on behalf.
- **[[DPO]]:** Not formally appointed. Article 37 GDPR trigger needs assessment — see [[Open Questions]].
- **Auditor:** [[Judge Dredd]] — Claude Code subagent at `.claude/agents/judge-dredd.md`.
- **Refresh trigger:** Governor invokes Judge Dredd whenever a project, agent, job, dataset, integration, or compliance artefact is **added, changed, or retired**.

## 2. Asset registers

- **Projects** — see `Projects/`. One note per project.
- **AI Systems / Agents** — see `Agents/`. Each has a paired entry in `Compliance/02 AI System Register/` with its [[Annex III - High-Risk AI Systems|Annex III]] classification.
- **Jobs** — see `Jobs/`. Scheduled tasks and pipelines.
- **Datasets** — see `Datasets/`. Persistent data stores.
- **Integrations** — see `Integrations/`. Third-party tools, doubles as glossary.

## 3. Compliance artefacts

| Pillar | Folder | Status |
|---|---|---|
| Records of Processing (ROPA) | `Compliance/01 Records of Processing/` | one ROPA per processing activity |
| AI System Register | `Compliance/02 AI System Register/` | one entry per AI agent |
| DPIAs | `Compliance/03 DPIAs/` | required where Art. 35 GDPR or Art. 26(9) AI Act triggers |
| International Transfers | `Compliance/04 International Transfers/` | TIA per non-EU processor |
| Processors and DPAs | `Compliance/05 Processors and DPAs/` | DPA signed per processor |
| Data Subject Rights | `Compliance/06 Data Subject Rights/` | procedure + register |
| Incidents | `Compliance/07 Incidents/` | procedure + register, 72-hour notification |
| Policies | `Compliance/08 Policies/` | data protection, acceptable AI use, AI literacy, vendor management, retention |
| Notices | `Compliance/09 Notices/` | AI transparency, worker notice, privacy notice |

## 4. Key applicable obligations (jurisdiction: EU / Malta)

- **[[Article 4 - AI Literacy|AI Act Article 4]]** — AI literacy programme for staff. **In force.**
- **[[Article 26 - Deployer Obligations|AI Act Article 26]]** — deployer duties for high-risk AI. **Applies 2 August 2026.**
- **[[Article 50 - AI Transparency|AI Act Article 50]]** — inform users they are interacting with AI. **Applies 2 August 2026.**
- **[[GDPR Article 30 - ROPA|GDPR Art. 30]]** — record of processing activities. **In force.**
- **[[GDPR Article 35 - DPIA|GDPR Art. 35]]** — DPIA where high-risk to data subjects. **In force.**
- **[[GDPR Article 28 - Processors|GDPR Art. 28]]** — written contract with each processor. **In force.**
- **[[GDPR Chapter V - International Transfers|GDPR Chapter V]]** — safeguards for transfers outside the EU/EEA. **In force.**
- **GDPR Article 33** — 72-hour personal-data-breach notification. **In force.**

## 5. Out of scope

- **[[Alfred]] / Polymarket** — Judge Dredd skips every file, env var, comment, and reference. Confirmed by the Governor.

## 6. Open questions and change log

- [[Open Questions]] — the only note humans edit.
- [[Change Log]] — Judge Dredd appends one line per refresh, most recent on top.
