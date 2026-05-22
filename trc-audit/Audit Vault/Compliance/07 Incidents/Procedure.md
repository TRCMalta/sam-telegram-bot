---
type: procedure
covers: ["GDPR Art. 33", "GDPR Art. 34", "AI Act Art. 26(5)"]
last_updated: 2026-05-22
owner: Jonathan (Governor)
---

# Incident Response Procedure

This procedure covers two overlapping duties:

- **GDPR Article 33** — notify the **Information and Data Protection Commissioner of Malta (IDPC)** within **72 hours** of becoming aware of a **[[Personal Data Breach]]**, unless the breach is unlikely to result in a risk to data subjects.
- **GDPR Article 34** — notify affected **data subjects** without undue delay where the breach is likely to result in a **high risk** to them.
- **AI Act Article 26(5)** — inform Sam's **provider** (Anthropic) of risks identified in operation; report serious incidents to the Maltese AI competent authority once designated.

## Detection sources

- Security alerts from [[Railway]], [[Microsoft]], [[Anthropic]] or [[Firefish]].
- Beverly, Jonathan, or another worker reports anomalous Sam behaviour.
- A third party reports an exposed credential.
- An AI literacy "near miss" surfaced by a worker.

## Triage — first 4 hours

1. **Confirm and contain.** Rotate credentials. Pause Sam if necessary. Capture logs from Railway before retention expires.
2. **Open an incident record** in `Register.md` with a sequential ID `INC-YYYY-NN`.
3. **Initial categorisation:**
   - Personal data involved? (yes / no)
   - Special category data? (yes / no)
   - Approximate number of data subjects affected.
   - Approximate volume of records.
4. **Notify the Governor** if not already aware.

## Decision — within 72 hours of awareness

| Trigger | Action |
|---|---|
| Personal data breach, **any** risk to data subjects | **Notify IDPC** under Art. 33. Use the IDPC online notification form. |
| Personal data breach, **high** risk to data subjects | Additionally **notify affected data subjects** under Art. 34. |
| No personal data, but operational impact | Document internally; no external notification required. |
| AI Act "serious incident" (death, serious damage to health, infrastructure damage, fundamental rights violation) | Notify the Maltese AI competent authority and Anthropic (Art. 26(5)). |

If unsure → notify. Late notification is enforceable. Conservative is correct.

## Communication

- **Single voice:** the Governor, or a named delegate, is the only channel that speaks to authorities and to affected data subjects. No improvised statements.
- **Template responses:** see `../09 Notices/`.

## Post-incident — within 5 working days

1. **Root-cause analysis** added to the incident record.
2. **Lessons-learned** translated into a mitigation tracked in `../03 DPIAs/` or as an [[Open Questions]] item.
3. **Tabletop exercise** scheduled annually to test this procedure.

## Contacts

| Role | Name | Channel |
|---|---|---|
| Governor | Jonathan | jonathan@theremarkablecollective.com |
| Maltese supervisory authority | IDPC | https://idpc.org.mt — `idpc.info@idpc.org.mt`, +356 2328 7100 |
| Anthropic incident contact | per Anthropic DPA | (confirm) |
| Microsoft Graph admin | per Microsoft tenant | (confirm) |
