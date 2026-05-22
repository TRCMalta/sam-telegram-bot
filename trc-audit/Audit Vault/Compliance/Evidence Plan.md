---
type: evidence-plan
last_updated: 2026-05-22
generated_by: scripts/build_evidence_plan.py
---

# Evidence Plan — per project, per control

> Generated. **Do not hand-edit** — rerun `python3 "Audit Vault/scripts/build_evidence_plan.py"` (or the umbrella `scripts/refresh.py`) instead. For every audited project, this is the **exact list of physical artefacts** the Governor must produce — and where they must live — for both Structural Readiness and Evidence-Backed Posture to read 100% on the dashboard. **Alfred / Polymarket is excluded.**

## Legend

- **Structural file** — the markdown file that must exist in the vault. Either Judge Dredd writes it on the next refresh, or the Governor writes it manually.
- **Evidence file** — the proof artefact the Governor drops into `Audit Vault/Compliance/Evidence/<subfolder>/`. Until something is there, the evidence column is ❌.
- ✅ = present, ❌ = missing.

## Summary

- **Projects audited:** 1
- **Structural readiness across all projects:** 11 of 12 required files in place (**92%**).
- **Evidence-backed posture across all projects:** 0 of 12 required artefacts on file (**0%**).

## Per-project plan

### Sam

_Type: agent_  ·  Structural: **11/12**  ·  Evidence: **0/12**

| Control | Article | Structural file (must exist) | Evidence file (must be dropped) | What the artefact is |
|---|---|---|---|---|
| **AI System Register entry** | AI Act Art. 6 + Annex III | ✅ `Compliance/02 AI System Register/Sam.md` | ❌ `Compliance/Evidence/Classification/<project>-classification-signed-YYYY-MM-DD.pdf` | Risk-tier classification confirmed in writing by the Governor. If high-risk, the full Article 26 stack applies. |
| **Record of Processing Activity** | GDPR Art. 30 | ✅ `Compliance/01 Records of Processing/Sam Chief of Staff.md` | ❌ `Compliance/Evidence/ROPA/<project>-ROPA-signed-YYYY-MM-DD.pdf` | PDF of the approved ROPA, dated and signed by the Governor. |
| **DPIA** | GDPR Art. 35 + AI Act Art. 26(9) | ❌ `Compliance/03 DPIAs/Sam.md` | ❌ `Compliance/Evidence/DPIAs/<project>-DPIA-signed-YYYY-MM-DD.pdf` | Signed DPIA. Required where high-risk processing or high-risk AI is involved. |
| **DPA — Anthropic** | GDPR Art. 28 | ✅ `Compliance/05 Processors and DPAs/Register.md` | ❌ `Compliance/Evidence/DPAs/Anthropic-DPA-YYYY-MM-DD.pdf` | Counter-signed Anthropic Data Processing Agreement. Required for any project that sends text to Claude. |
| **DPA — Microsoft** | GDPR Art. 28 | ✅ `Compliance/05 Processors and DPAs/Register.md` | ❌ `Compliance/Evidence/DPAs/Microsoft-DPA-YYYY-MM-DD.pdf` | Microsoft Online Services DPA (Product Terms). Required if the project uses Microsoft Graph. |
| **DPA — Railway** | GDPR Art. 28 | ✅ `Compliance/05 Processors and DPAs/Register.md` | ❌ `Compliance/Evidence/DPAs/Railway-DPA-YYYY-MM-DD.pdf` | Counter-signed Railway DPA. Required for any project hosted on Railway. |
| **Transfer Impact Assessment (US processors)** | GDPR Chapter V | ✅ `Compliance/04 International Transfers/Transfer Register.md` | ❌ `Compliance/Evidence/Transfers/<recipient>-TIA-YYYY-MM-DD.pdf` | Completed Transfer Impact Assessment per non-adequate recipient (Anthropic, Microsoft, Railway, Meta WhatsApp where applicable). Either DPF certification screenshot or executed SCCs. |
| **Incident-response readiness** | GDPR Art. 33 | ✅ `Compliance/07 Incidents/Procedure.md` | ❌ `Compliance/Evidence/Incidents/tabletop-YYYY-MM-DD.md` | Record of an annual tabletop exercise that walks through the 72-hour notification. |
| **AI literacy (per worker using this AI)** | AI Act Art. 4 (in force) | ✅ `Compliance/08 Policies/AI Literacy Programme.md` | ❌ `Compliance/Evidence/AI Literacy/<worker-name>-literacy-YYYY-MM-DD.pdf` | One training-completion record per worker who uses or oversees this AI system. |
| **AI transparency notice live** | AI Act Art. 50 (effective 2 Aug 2026) | ✅ `Compliance/09 Notices/AI Transparency Notice.md` | ❌ `Compliance/Evidence/AI Transparency/<project>-disclosure-screenshot-YYYY-MM-DD.png` | Screenshot of the first-message AI disclosure live on the channel(s) the project uses. Plus screenshot of the bot profile description. |
| **Worker notification served** | AI Act Art. 26(7) (effective 2 Aug 2026) | ✅ `Compliance/09 Notices/Worker Notification.md` | ❌ `Compliance/Evidence/Worker Notification/<worker-name>-acknowledgment-YYYY-MM-DD.pdf` | Counter-signed worker notification from every worker whose data the AI can read. Required only for high-risk AI. |
| **Logs retained ≥ 6 months** | AI Act Art. 26(6) (effective 2 Aug 2026) | ✅ `Compliance/02 AI System Register/Sam.md` | ❌ `Compliance/Evidence/Log Retention/<project>-log-retention-screenshot-YYYY-MM-DD.png` | Screenshot from the hosting provider (e.g. Railway) showing the log-retention setting is ≥ 6 months. |
