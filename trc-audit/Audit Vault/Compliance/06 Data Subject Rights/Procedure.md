---
type: procedure
covers: ["GDPR Arts. 12-22"]
last_updated: 2026-05-22
owner: Jonathan (Governor)
---

# Data Subject Rights Procedure

A data subject ("the requester") can ask TRC to exercise the rights below. TRC must respond **within one month** (extendable by two further months for complex requests, with notification).

| Right | Article | Plain English |
|---|---|---|
| Information | 13-14 | Tell people what TRC does with their data. Met by the privacy notice in `../09 Notices/`. |
| Access | 15 | Provide a copy of the personal data TRC holds. |
| Rectification | 16 | Correct inaccurate data. |
| Erasure | 17 | Delete data ("right to be forgotten") on limited grounds. |
| Restriction | 18 | Stop processing while a dispute is resolved. |
| Portability | 20 | Provide data in a structured machine-readable format. |
| Object | 21 | Object to processing based on legitimate interests. |
| Automated decisions | 22 | Right not to be subject to a solely automated decision producing legal effects — relevant to AI systems. |

## Intake

- Inbound channel: a request can arrive by email, Telegram, WhatsApp, or via a worker.
- Forward to the Governor within 24 hours of receipt.
- Open a row in `Register.md` with ID `DSR-YYYY-NN`.

## Verification

Confirm the requester's identity proportionately. Do not collect more data than necessary. If identity cannot be reasonably verified, refuse with reasons (Art. 12(6)).

## Action

1. Locate the personal data across TRC sources: [[Microsoft Graph|Outlook]], [[Firefish]], [[Odoo]], [[Railway]] logs, [[Anthropic]] cached conversations (request a delete from Anthropic if applicable).
2. Apply the right requested. Where third parties hold the data, route the request to them under [[GDPR Article 28 - Processors|Article 28]] DPAs.
3. Document every step in the register.

## Communication

- Respond in writing.
- Quote the article being exercised.
- Where TRC refuses, give reasons and refer the requester to the IDPC.

## Special cases

- **AI Act Article 50(5)** — when the request relates to disclosure of an AI interaction, the response itself must be in clear, distinguishable language.
- **AI Act Article 86 (right to explanation of individual decision)** — if TRC ever uses AI for a decision producing legal or similarly significant effects on a person, that person is entitled to an explanation. Reference here even though no such use case is live.
