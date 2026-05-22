---
type: open-questions
last_updated: 2026-05-22
---

# Open Questions

> The **only** note humans edit. [[Judge Dredd]] carries unanswered items forward between refreshes and never silently drops them. Tick a box once the Governor has confirmed the answer in writing and filed evidence in `Compliance/Evidence/`.

## A. Governance

- [ ] Confirm the Governor's signing email and a named backup (for incident response if Jonathan is unreachable).
- [ ] Document the incident-response on-call path: who is paged if Sam goes down at 02:00?
- [ ] Decide whether to appoint a **[[DPO]]** — see `Compliance/08 Policies/DPO Assessment.md`.
- [ ] Confirm TRC's registration / data-controller contact details with the **Maltese IDPC**.

## B. EU AI Act — Sam classification

- [ ] **Confirm Sam's risk classification.** If Sam materially assists in candidate selection, performance review, or work-allocation decisions, it is **high-risk under [[Annex III - High-Risk AI Systems|Annex III §4]]** and the full [[Article 26 - Deployer Obligations|Article 26]] stack applies. The Governor must record this decision and the reasoning in `Compliance/02 AI System Register/Sam.md`.
- [ ] Set Railway log retention to **≥ 6 months** (AI Act Art. 26(6)) and capture the configuration screenshot.
- [ ] Sign and serve the [[Worker Notification]] to Beverly and to any worker whose data Sam reads (AI Act Art. 26(7)).
- [ ] Embed the [[AI Transparency Notice]] in Sam's Telegram and WhatsApp first-message flow **before 2 August 2026** (AI Act Art. 50).
- [ ] Complete the [[AI Literacy Programme]] training for Jonathan and Beverly and file the records (AI Act Art. 4 — already in force).
- [ ] Complete the DPIA for Sam (`Compliance/03 DPIAs/Sam.md`).

## C. GDPR — processors and transfers

- [ ] Confirm a signed [[Data Processing Agreement|DPA]] exists with each processor in `Compliance/05 Processors and DPAs/Register.md`. Drop each PDF into `Compliance/Evidence/`.
- [ ] Clarify [[Firefish]] controller/processor split in writing.
- [ ] Confirm which specific [[Anthropic]] and [[Microsoft]] legal entities TRC contracts with, and which appear on the active **EU-US Data Privacy Framework** list — vs which are covered by [[Standard Contractual Clauses|SCCs]] only.
- [ ] Confirm [[Railway]] transfer mechanism (DPF vs SCCs in its DPA) against Railway's current DPA.
- [ ] Document the [[Telegram Bot API|Telegram]] DPA gap and Governor's residual-risk decision.
- [ ] Complete Transfer Impact Assessments for Anthropic, Microsoft, Railway, Telegram, Meta WhatsApp.

## D. GDPR — processing activities

- [ ] Confirm Sam's lawful basis for processing data of TRC workers other than Beverly (default proposed: Article 6(1)(f) legitimate interests).
- [ ] Confirm the lawful basis on which Firefish candidate data was originally collected, and whether reading by Sam stays within that basis.
- [ ] Audit whether [[Special Category Data]] (Art. 9 GDPR) flows through Sam — and if so, what Article 9 basis applies.
- [ ] Confirm Anthropic prompt/response retention setting (target: zero retention).

## E. Data subjects and rights

- [ ] Publish a **privacy notice** (Arts. 13-14 GDPR) covering Sam's processing — distinct from the AI-transparency notice.
- [ ] Tabletop exercise the [[Compliance/07 Incidents/Procedure|incident-response procedure]] within 6 months.
- [ ] Tabletop exercise the [[Compliance/06 Data Subject Rights/Procedure|data-subject-rights procedure]].

## F. Scoping notes carried from research

- [ ] Confirm in writing that **[[Article 27 - FRIA|FRIA]]** does not apply to TRC (private SME, not a public body or essential-service deployer). Document non-applicability in `Compliance/03 DPIAs/`.
- [ ] Confirm **NIS2** non-applicability with the Maltese cybersecurity authority and document the finding.
- [ ] Confirm whether TRC ever acts as a **provider** of synthetic content under AI Act Art. 50(2) — if no, that obligation does not apply to TRC; document.

## G. Out of scope

- [ ] Confirm in writing that **[[Alfred]] / Polymarket** is permanently out of scope for this audit programme. Re-affirm at every annual review.
