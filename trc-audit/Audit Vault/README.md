---
type: meta
governor: Jonathan
created: 2026-05-22
jurisdiction: EU (Malta)
applicable_law: ["GDPR (Regulation 2016/679)", "EU AI Act (Regulation 2024/1689)", "Maltese Data Protection Act"]
---

# TRC Audit Vault

This folder is an **Obsidian vault subfolder**. Open it as its own vault, or drag it into an existing vault — Obsidian will resolve every `[[wikilink]]` automatically.

It is the **standalone master audit programme** for The Remarkable Collective (TRC), an SME established in Malta and therefore subject to **EU law**: the **General Data Protection Regulation (GDPR)** and the **EU AI Act (Regulation 2024/1689)**.

The audit is owned by the **Governor** (Jonathan, `jonathan@theremarkablecollective.com`) and maintained by the **[[Judge Dredd]]** Claude Code subagent.

> **[[Alfred]] / Polymarket is explicitly out of scope** of this audit programme by the Governor's standing instruction.

## Why this exists

TRC operates AI systems that read personal data: candidate records in [[Firefish]], HR records in [[Odoo]], and Beverly Cutajar's [[Microsoft Graph|Outlook mailbox]]. Under EU law this triggers concrete, dated obligations:

| Obligation | Source | Effective | Status |
|---|---|---|---|
| AI literacy programme for staff using AI systems | [[Article 4 - AI Literacy\|AI Act Art. 4]] | **In force (2 Feb 2025)** | gap — see Compliance Posture |
| Transparency notice when a person interacts with AI | [[Article 50 - AI Transparency\|AI Act Art. 50]] | **2 Aug 2026** | gap |
| Deployer obligations for high-risk AI (oversight, logs ≥ 6 months, worker notice, DPIA) | [[Article 26 - Deployer Obligations\|AI Act Art. 26]] | **2 Aug 2026** | gap |
| Record of processing activities | [[GDPR Article 30 - ROPA\|GDPR Art. 30]] | In force | gap |
| Data protection impact assessment | [[GDPR Article 35 - DPIA\|GDPR Art. 35]] / AI Act Art. 26(9) | In force / 2 Aug 2026 | gap |
| Processor agreements with each vendor | [[GDPR Article 28 - Processors\|GDPR Art. 28]] | In force | check signatures |
| Transfer Impact Assessment for non-EU vendors | [[GDPR Chapter V - International Transfers\|GDPR Ch. V]] | In force | gap (Anthropic, Microsoft) |
| 72-hour breach notification procedure | GDPR Art. 33 | In force | procedure drafted, not tested |

This vault is the **evidence file** the audit team will read when they need to show a supervisory authority — the **Information and Data Protection Commissioner of Malta (IDPC)** or, for the AI Act, the future Maltese AI competent authority — that TRC has met its obligations.

## What lives where

### Asset registers (the things TRC operates)

| Folder | Holds |
|---|---|
| `Projects/` | One note per TRC project (the bots, APIs, dashboards). |
| `Agents/` | One note per AI agent (Sam, [[Judge Dredd]], any future agent). |
| `Jobs/` | One note per scheduled job or pipeline. |
| `Datasets/` | One note per persistent data store. |
| `Integrations/` | One note per third-party tool. Doubles as the plain-English glossary entry. |
| `Concepts/` | One note per technical or regulatory term. The full glossary. |

### Compliance artefacts (the controls)

| Folder | Holds | Driven by |
|---|---|---|
| `Compliance/01 Records of Processing/` | One ROPA per processing activity. | [[GDPR Article 30 - ROPA\|GDPR Art. 30]] |
| `Compliance/02 AI System Register/` | One entry per AI system with risk classification and deployer obligations. | [[Article 26 - Deployer Obligations\|AI Act Art. 26]] |
| `Compliance/03 DPIAs/` | DPIA for any high-risk processing or high-risk AI. | [[GDPR Article 35 - DPIA\|GDPR Art. 35]] + AI Act Art. 26(9) |
| `Compliance/04 International Transfers/` | Transfer register + Transfer Impact Assessments. | [[GDPR Chapter V - International Transfers\|GDPR Ch. V]] |
| `Compliance/05 Processors and DPAs/` | One entry per processor with DPA status. | [[GDPR Article 28 - Processors\|GDPR Art. 28]] |
| `Compliance/06 Data Subject Rights/` | Procedure + incoming request log. | GDPR Arts. 12-22 |
| `Compliance/07 Incidents/` | Breach-response procedure + register. | GDPR Art. 33 |
| `Compliance/08 Policies/` | Internal policies (Data Protection, Acceptable AI Use, AI Literacy, Vendor Management, Retention). | best practice + statutory |
| `Compliance/09 Notices/` | External notices (AI transparency, worker notification, privacy notice). | GDPR Arts. 13-14, AI Act Arts. 26(7) & 50 |
| `Compliance/Evidence/` | Attachments and screenshots referenced by other artefacts. | best practice |

### Outputs

| File | Purpose |
|---|---|
| `Master Audit.md` | The hub. Links to every register and compliance artefact. |
| `Compliance Posture.md` | Single-page status report: where TRC stands today, by obligation. |
| `Open Questions.md` | The only note humans edit. Unanswered items carry forward. |
| `Change Log.md` | One line per audit refresh, most recent on top. |
| `Dashboard.html` | Gamified HTML view for the audit team. Includes the **Download Word Report** button. |
| `TRC-Audit.docx` | The Word document the audit team reads. Generated from this vault. |

## How to refresh

The Governor invokes [[Judge Dredd]] from a [[Claude Code]] session pointed at this vault:

```
> /agent judge-dredd "Refresh the TRC audit. Sam now also reads Teams chats — re-evaluate the AI System Register."
```

Judge Dredd will walk the vault, diff against current state, update every affected register and compliance artefact, append the [[Change Log]], regenerate `TRC-Audit.docx` and `Dashboard.html`, and report back. The Governor is the only sign-off authority.

## Separation of duties

| Role | Held by | Responsibility |
|---|---|---|
| [[Data Controller]] | TRC (Governor signs) | Decides purpose and means of processing. |
| Governor | Jonathan | Owns this audit programme. |
| [[DPO]] (assessed) | Not formally appointed — see [[Open Questions]] | Mandatory only if Art. 37 GDPR criteria are met. Recruitment processing may trigger this. |
| Auditor | [[Judge Dredd]] | Independent — produces this evidence file. |
| Asset owners | Per asset note (`owner:` frontmatter) | Day-to-day operation. |

If two roles are held by the same person, that fact is **documented as a conflict-of-duties statement**, not implied.
