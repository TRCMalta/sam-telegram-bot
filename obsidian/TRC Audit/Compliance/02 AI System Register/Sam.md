---
type: ai-system-register
name: Sam
status: live
risk_classification: HIGH-RISK (Annex III §4) — pending Governor confirmation
provider: Anthropic (Claude) — TRC integrates Claude into Sam
deployer: TRC
owner: Jonathan (Governor)
human_oversight: Jonathan (Governor) — see oversight evidence below
log_retention_target: ≥ 6 months on Railway
linked_dpia: ../03 DPIAs/Sam.md
linked_ropa: ../01 Records of Processing/Sam Chief of Staff.md
last_updated: 2026-05-22
---

# AI System Register Entry — Sam

This entry meets the AI System Register requirement that TRC will be expected to produce when [[Article 26 - Deployer Obligations|AI Act Article 26]] starts to apply (**2 August 2026**). It is the primary evidence file for Sam.

## 1. System description (plain English)

Sam is an AI chief-of-staff agent. It receives messages on [[Telegram Bot API|Telegram]] and [[WhatsApp Cloud API|WhatsApp]] from Beverly Cutajar (COO) and a small allow-list, forwards the conversation to [[Claude]] with a system prompt that defines its role, and returns the reply. Sam reads operational data from [[Odoo]] (HR / CRM / accounting), [[Firefish]] (recruitment CRM), and [[Microsoft Graph]] (Outlook mail, Teams chats, OneDrive, calendar) to answer Beverly's questions.

## 2. Risk classification under the EU AI Act

| Tier | Applies? | Why |
|---|---|---|
| Prohibited (Art. 5) | No | Sam does not perform social scoring, biometric categorisation, manipulation, etc. |
| **High-risk — Annex III §4 (employment / workers management)** | **Likely yes** | Sam reads [[Firefish]] (candidates) and [[Odoo]] (HR). Even if Sam only "answers questions" rather than making the decision itself, EDPB and AI Office guidance treats AI that materially assists recruitment ranking, performance monitoring, or work-allocation as in scope. The Governor must confirm. |
| High-risk — Annex I (safety component of regulated products) | No | Not a safety component of any product. |
| Limited risk — chatbot transparency (Art. 50) | Yes, **in addition** | Sam interacts with natural persons → [[Article 50 - AI Transparency\|Art. 50]] disclosure required from 2 Aug 2026. |
| Minimal risk | n/a | Pre-empted by higher tier. |

**Conclusion (pending Governor sign-off):** classify Sam as **high-risk under Annex III §4**. Treat the full [[Article 26 - Deployer Obligations|Art. 26]] stack as applicable. If the Governor confirms Sam does **not** influence recruitment or HR decisions in any way — i.e. it only summarises calendar and mail — re-classify as limited-risk with only Art. 50 applying. Record the decision and reasoning here.

## 3. Article 26 deployer obligations — evidence checklist

| Sub-paragraph | Obligation | TRC evidence | Status |
|---|---|---|---|
| Art. 26(1) | Use system per provider's instructions | Anthropic [usage policies](https://www.anthropic.com/legal/usage-policy) acknowledged | **OPEN** — Governor to confirm in writing |
| Art. 26(2) | Assign human oversight to competent persons | Governor named oversight authority. Competence evidenced by AI literacy training record. | **DRAFT** |
| Art. 26(4) | Input data relevance and representativeness | Sam's input data is Beverly's live operational data — by definition representative. Documented in [[Sam Chief of Staff\|ROPA]]. | **DRAFT** |
| Art. 26(5) | Monitor operation, inform provider of risks | Quarterly review against Anthropic incidents page; incident workflow per `../07 Incidents/Procedure.md` | **DRAFT** |
| Art. 26(6) | Keep AI system logs ≥ 6 months | Railway log retention target ≥ 6 months. **Action: confirm setting and capture screenshot.** | **GAP** |
| Art. 26(7) | Inform workers before deploying high-risk AI | `../09 Notices/Worker Notification.md` to Beverly and any other worker whose data Sam reads. **Action: serve and counter-sign.** | **GAP** |
| Art. 26(8) | EU database registration | Applies to providers more than deployers; confirm via [EU AI Act database](https://digital-strategy.ec.europa.eu/en/policies/eu-ai-act) once live. | **OPEN** |
| Art. 26(9) | DPIA when necessary | `../03 DPIAs/Sam.md`. **Action: complete.** | **GAP** |
| Art. 26(12) | Cooperate with authorities | Procedure: route any inbound from IDPC or Maltese AI competent authority to Governor within 24 h. | **DRAFT** |

## 4. Article 50 transparency

From **2 August 2026**, Sam must disclose to every user at the time of first interaction that they are talking to an AI. See `../09 Notices/AI Transparency Notice.md` for the wording.

**Implementation:** on first message from a new Telegram chat or WhatsApp thread, Sam prepends a one-sentence disclosure. The disclosure is also documented in the Telegram bot description and WhatsApp business profile.

## 5. AI literacy ([[Article 4 - AI Literacy|Art. 4]] — already in force)

Beverly (primary user), Jonathan (Governor), and any TRC staff who operate Sam must have completed the AI Literacy Programme defined in `../08 Policies/AI Literacy Programme.md`. Training records live in `../Evidence/`.

## 6. Data protection link

This AI system register entry is paired with:

- **ROPA:** [[Sam Chief of Staff]] — `../01 Records of Processing/Sam Chief of Staff.md`
- **DPIA:** `../03 DPIAs/Sam.md`
- **Processors:** [[Anthropic]], [[Microsoft Graph|Microsoft]], [[Railway]], [[Firefish]], [[Odoo]]. See `../05 Processors and DPAs/Register.md`.
- **International transfers:** Anthropic (US), Microsoft (US). See `../04 International Transfers/Transfer Register.md`.

## 7. Change history

- **2026-05-22** — initial entry. Classification pending Governor confirmation.
