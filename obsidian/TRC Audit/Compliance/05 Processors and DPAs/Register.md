---
type: processor-register
last_updated: 2026-05-22
controller: TRC
---

# Processor Register — DPA Status

Every third party that processes personal data **on TRC's behalf** must be governed by a written contract under [[GDPR Article 28 - Processors|Article 28 GDPR]]. The contract is commonly called a [[Data Processing Agreement|DPA]].

| # | Processor | Service | Acts as | DPA in place | DPA version / link | Sub-processors transparent? | International transfer? |
|---|---|---|---|---|---|---|---|
| 1 | [[Anthropic]] | Claude API | Processor | **CONFIRM** — Anthropic Commercial Terms include a DPA on request | `../Evidence/Anthropic-DPA-<date>.pdf` | Listed in [Anthropic sub-processor page](https://www.anthropic.com/legal/subprocessors) | Yes — US ([[Standard Contractual Clauses\|SCCs]]) |
| 2 | [[Microsoft]] | Microsoft Graph | Processor | **CONFIRM** — Microsoft Online Services DPA (Product Terms) | `../Evidence/Microsoft-DPA-<date>.pdf` | Yes (Microsoft sub-processor list) | Yes — primary EU residency, US backend (DPF + SCCs) |
| 3 | [[Railway]] | Hosting and logs | Processor | **CONFIRM** | `../Evidence/Railway-DPA-<date>.pdf` | Confirm | Yes — US |
| 4 | [[Firefish]] | Recruitment CRM | **Likely controller** of source records; TRC is processor of the read-out, **or** Firefish is processor on TRC's behalf — depends on contract. **Clarify.** | Pending | | | UK adequacy |
| 5 | [[Odoo]] (Think Talent self-hosted) | CRM / HR / accounting | Controller (Think Talent) — TRC reads via API | n/a (intra-group; document data-sharing basis) | | | Within EU |
| 6 | [[Telegram Bot API\|Telegram]] | Messaging channel | Likely controller of the communications metadata, processor of message content for delivery | **No standard DPA available** — note as risk in [[Open Questions]] | | | Outside EU; transparency gap |
| 7 | [[WhatsApp Cloud API\|Meta WhatsApp]] | Messaging channel | Processor under Meta's WhatsApp Business DPA | **CONFIRM** | `../Evidence/Meta-DPA-<date>.pdf` | Yes | Yes — DPF + SCCs |

## Action items

- [ ] Governor confirms a signed DPA exists for each processor and drops the PDF into `../Evidence/`.
- [ ] Clarify [[Firefish]] controller/processor split in writing.
- [ ] Document the Telegram gap and the residual-risk decision (continue use vs alternative).
- [ ] Set a 12-month review reminder for every DPA.
