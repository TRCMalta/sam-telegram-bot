---
type: transfer-register
last_updated: 2026-05-22
controller: TRC
---

# International Transfer Register

Every transfer of personal data outside the EU/EEA. Required under [[GDPR Chapter V - International Transfers|GDPR Chapter V]] (Articles 44-49). Each row links to a Transfer Impact Assessment (TIA) where personal data is in scope.

| # | Recipient | Country | Service | Personal data in scope? | Safeguard | TIA |
|---|---|---|---|---|---|---|
| 1 | [[Anthropic]] | US | Claude API — receives conversation text | Yes (Beverly's queries, may quote HR / candidate data) | [[Standard Contractual Clauses\|SCCs]] in Anthropic DPA + (if applicable) [[Data Processing Agreement\|DPF]] | `TIA - Anthropic.md` |
| 2 | [[Microsoft]] | US (with EU Data Boundary) | Microsoft Graph API | Yes (mail bodies, calendar, Teams) | EU Data Boundary commitment + SCCs | `TIA - Microsoft.md` |
| 3 | [[Railway]] | US | Hosting and logs | Yes (logs of conversations) | SCCs in Railway DPA | `TIA - Railway.md` |
| 4 | [[Firefish]] | UK | Recruitment CRM (read by Sam) | Yes (candidate data) | UK adequacy decision under Article 45 | n/a (adequacy) |
| 5 | [[Telegram Bot API\|Telegram]] | UAE / global infrastructure | Messaging channel | Yes (message metadata, user IDs) | SCCs unclear — confirm | `TIA - Telegram.md` |
| 6 | [[WhatsApp Cloud API\|Meta]] | US backend, EU front | Messaging channel | Yes (phone numbers, messages) | EU-US DPF + SCCs in Meta DPA | `TIA - Meta WhatsApp.md` |

## Action items

- [ ] Governor confirms each recipient's **current** safeguard mechanism (DPF certifications change — re-check on the [Data Privacy Framework list](https://www.dataprivacyframework.gov/list)).
- [ ] Signed DPA from each recipient stored in `../Evidence/`.
- [ ] Complete one TIA per non-adequate recipient.
