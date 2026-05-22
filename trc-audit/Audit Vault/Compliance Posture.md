---
type: posture
last_updated: 2026-05-22
governor: Jonathan
---

# Compliance Posture — TRC, as of 2026-05-22

> One-page status report for the Governor. Maintained by [[Judge Dredd]]. Read this **before** [[Master Audit]] when you only have five minutes.

## Headline

TRC is an **EU-established SME (Malta)** operating AI agents that process personal data — including data that likely brings at least one system within scope of the EU AI Act's **high-risk** tier (Annex III §4, employment/recruitment). **Material obligations apply from 2 August 2026** and several GDPR obligations are already in force and currently un-evidenced.

## Status by obligation

| # | Obligation | Source | Effective | Evidence in vault | Posture |
|---|---|---|---|---|---|
| 1 | AI literacy programme | [[Article 4 - AI Literacy\|AI Act Art. 4]] | 2 Feb 2025 — **in force** | `Compliance/08 Policies/AI Literacy Programme.md` (outline only) | **GAP** — programme drafted, no completed training records |
| 2 | AI System Register with risk classification | [[Article 26 - Deployer Obligations\|AI Act Art. 26]] preparation | from 2 Aug 2026 | `Compliance/02 AI System Register/` | **DRAFT** — Sam classified as Annex III §4 candidate, awaiting Governor confirmation |
| 3 | Transparency to users interacting with AI | [[Article 50 - AI Transparency\|AI Act Art. 50]] | 2 Aug 2026 | `Compliance/09 Notices/AI Transparency Notice.md` (template) | **GAP** — notice must be embedded in Sam's first message in Telegram and WhatsApp |
| 4 | Inform workers before deploying high-risk AI affecting them | AI Act Art. 26(7) | 2 Aug 2026 | `Compliance/09 Notices/Worker Notification.md` (template) | **GAP** — Beverly and any worker whose data Sam reads must be informed in writing |
| 5 | Human oversight by competent personnel | AI Act Art. 26(2) | 2 Aug 2026 | `Compliance/02 AI System Register/Sam.md` | **DRAFT** — Governor named as oversight authority; competence evidence pending |
| 6 | Keep AI system logs ≥ 6 months | AI Act Art. 26(6) | 2 Aug 2026 | `Projects/` Sam note | **GAP** — confirm Railway retention; current default may be shorter |
| 7 | Record of Processing Activities | [[GDPR Article 30 - ROPA\|GDPR Art. 30]] | in force | `Compliance/01 Records of Processing/` | **DRAFT** — ROPA for Sam written; further activities to capture |
| 8 | DPIA where high-risk processing | [[GDPR Article 35 - DPIA\|GDPR Art. 35]] + AI Act Art. 26(9) | in force / 2 Aug 2026 | `Compliance/03 DPIAs/` | **GAP** — DPIA for Sam not yet completed |
| 9 | Processor agreements (DPA) per vendor | [[GDPR Article 28 - Processors\|GDPR Art. 28]] | in force | `Compliance/05 Processors and DPAs/Register.md` | **GAP** — confirm a signed DPA exists with Anthropic, Microsoft, Railway, Firefish, Odoo |
| 10 | Safeguards for transfers outside EU/EEA | [[GDPR Chapter V - International Transfers\|GDPR Ch. V]] | in force | `Compliance/04 International Transfers/Transfer Register.md` | **GAP** — Anthropic (US) and Microsoft (US) require SCCs + Transfer Impact Assessment |
| 11 | Personal-data-breach procedure (72 h) | GDPR Art. 33 | in force | `Compliance/07 Incidents/Procedure.md` | **DRAFT** — procedure written, no tabletop exercise run |
| 12 | Data-subject-rights procedure | GDPR Arts. 12-22 | in force | `Compliance/06 Data Subject Rights/Procedure.md` | **DRAFT** |
| 13 | DPO appointment assessment | GDPR Art. 37 | in force | `Compliance/08 Policies/DPO Assessment.md` | **OPEN QUESTION** — recruitment data processing may trigger mandatory appointment |
| 14 | Maltese IDPC controller registration / contact | Maltese DPA | in force | n/a | **OPEN QUESTION** — confirm registration status with IDPC |

## Headline risks if not addressed by 2 August 2026

- **Article 50 (transparency).** A user messaging Sam on WhatsApp who is not told they are interacting with AI is a clear, easy-to-prove infringement. Fines under Art. 99: up to **€15 m or 3% of global turnover** (whichever is higher — for SMEs, capped at the lower).
- **Article 26 (deployer obligations).** Same penalty band. The most visible deliverables a regulator will ask for: the risk classification, the DPIA, the worker notice, the log-retention evidence.
- **GDPR Chapter V (transfers).** US transfers without SCCs are an ongoing enforcement priority. The recent EDPB action history (Meta, Uber) shows supervisory authorities will fine on this even where no breach occurred.

## What the Governor needs to do next (priority order)

1. **Confirm Sam's classification** — is it used (or could it be used) for candidate evaluation, recruitment ranking, or work-related decisions? See `Compliance/02 AI System Register/Sam.md`. If yes → Annex III §4 high-risk and the full Article 26 stack applies.
2. **Run the DPO assessment.** Tick the test in `Compliance/08 Policies/DPO Assessment.md`. If positive, appoint and notify the IDPC.
3. **Confirm signed DPAs exist** with Anthropic, Microsoft, Railway, Firefish, Odoo. Drop the PDFs into `Compliance/Evidence/`.
4. **Sign and serve the worker notification** (`Compliance/09 Notices/Worker Notification.md`) to Beverly and to any worker whose data Sam can read.
5. **Embed the AI transparency line** into Sam's first response on Telegram and WhatsApp. One sentence is enough. Done before 2 August 2026.
6. **Complete the DPIA** for Sam. Use the template in `Compliance/03 DPIAs/Template.md`.
7. **Set Railway log retention to ≥ 6 months** and capture the screenshot under `Compliance/Evidence/`.

## What is **not** a risk

- [[Article 27 - FRIA|Fundamental Rights Impact Assessment]] — applies primarily to public bodies and deployers of essential services. TRC as a private SME recruitment business is **not in the targeted population**. Document the non-applicability in `Compliance/03 DPIAs/` and move on.
- The **prohibited AI list** (AI Act Art. 5). TRC operates nothing in that tier.
- **NIS2.** TRC is not listed as an essential or important entity under Annex I/II based on current sectoral scope. Confirm with the Maltese cybersecurity authority and document the finding.
