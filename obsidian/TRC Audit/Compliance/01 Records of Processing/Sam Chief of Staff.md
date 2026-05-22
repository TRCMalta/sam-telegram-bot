---
type: ropa
activity: Sam — AI Chief of Staff
controller: TRC
controller_contact: jonathan@theremarkablecollective.com
last_updated: 2026-05-22
---

# Record of Processing Activity — Sam, AI Chief of Staff

This record meets the [[GDPR Article 30 - ROPA|Article 30 GDPR]] requirement for a controller's record of processing activities.

## 1. Controller details

- **Name:** The Remarkable Collective ([[TRC]]).
- **Establishment:** Malta.
- **Contact:** Jonathan, jonathan@theremarkablecollective.com (Governor).
- **DPO:** Not formally appointed — see [[Open Questions]].
- **Joint controllers:** None.

## 2. Purposes of the processing

- Provide Beverly Cutajar (COO) with an AI assistant that can answer questions and draft replies using her own operational data.
- Maintain an internal audit and incident trail.

## 3. Categories of data subjects

- Beverly Cutajar (primary user).
- TRC staff whose data appears in Beverly's mailbox, calendar, Teams chats, [[Odoo]] HR / CRM, or [[Firefish]] candidate pipelines.
- Job candidates referenced in [[Firefish]].
- External correspondents who email or message Beverly.

## 4. Categories of personal data

| Category | Source | Example |
|---|---|---|
| Identification data | [[Microsoft Graph]] / [[Odoo]] / [[Firefish]] | name, email, phone |
| Employment / recruitment data | [[Firefish]] / [[Odoo]] | CVs, role, salary band, performance notes |
| Communications | [[Microsoft Graph]] | mail bodies, calendar entries, Teams messages |
| Identifiers | [[Telegram Bot API]] / [[WhatsApp Cloud API]] | Telegram user ID, WhatsApp number |

**[[Special Category Data]]:** to be assessed. CVs and HR records may include health, trade-union membership, or other special categories. Flag in [[Open Questions]].

## 5. Categories of recipients

- [[Anthropic]] (US) — processor — receives the conversation text for inference.
- [[Microsoft]] (US/IE) — processor for Graph API.
- [[Railway]] (US) — processor providing hosting and logging.
- [[Odoo]] (self-hosted at thinktalent.com.mt) — controller of source records; TRC reads via API.
- [[Firefish]] (UK) — controller of source records; TRC reads via API.
- [[Telegram Bot API|Telegram]] (Meta-adjacent) — communications channel.
- [[WhatsApp Cloud API|Meta]] (Ireland for EU traffic, US for backend) — communications channel.

## 6. International transfers

Transfers to the **United States** occur each time a message is processed:

- **[[Anthropic]]** — US-based. Safeguard: Standard Contractual Clauses in Anthropic's DPA. **Transfer Impact Assessment:** see `../04 International Transfers/TIA - Anthropic.md`.
- **[[Microsoft]]** — primary EU data residency for many Graph endpoints, with sub-processing in the US. Safeguard: Microsoft's EU Data Boundary + SCCs. **TIA:** `../04 International Transfers/TIA - Microsoft.md`.

## 7. Retention

- **Telegram / WhatsApp conversation cache:** in-process only — not persisted by TRC.
- **Railway logs:** target ≥ 6 months (AI Act Art. 26(6)). Confirm setting.
- **Anthropic prompt/response retention:** per Anthropic's commercial terms — default 30 days, "zero data retention" available. **Action:** confirm contractual setting in `../05 Processors and DPAs/Anthropic.md`.
- **Underlying source systems** ([[Odoo]], [[Firefish]], [[Microsoft Graph]]) retain per their own controllers' schedules — TRC does not duplicate.

## 8. Technical and organisational measures

- All credentials stored as Railway [[Environment variable]]s. Never committed.
- Telegram / WhatsApp messages only accepted from an explicit allow-list of user IDs / numbers.
- Webhook signature verification on inbound calls.
- Code reviewed; changes pushed only through GitHub.
- Audit log retained per Art. 26(6).

## 9. Lawful basis

- For Beverly's own data: **Article 6(1)(b) GDPR — necessary for performance of contract** (her employment).
- For data of other TRC workers visible in Beverly's mailbox: **Article 6(1)(f) — legitimate interests** (operating the company efficiently), balanced by the worker notification under AI Act Art. 26(7).
- For job-candidate data in [[Firefish]] read by Sam: **Article 6(1)(f) legitimate interests**, subject to the original lawful basis on which candidate data was collected. **To re-confirm with Firefish controller.**

## 10. DPIA link

A DPIA is required under [[GDPR Article 35 - DPIA|GDPR Art. 35]] and (if Sam is classified high-risk) under AI Act Art. 26(9). See `../03 DPIAs/Sam.md`.

## 11. Change history

- **2026-05-22** — initial record created.
