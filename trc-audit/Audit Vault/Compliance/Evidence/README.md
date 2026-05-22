# Evidence Folder

This is where the **proof** for every compliance control lives. Until a file is dropped here, the Evidence-Backed Posture score for that control is **0**.

The audit dashboard tracks **two** scores:

- **Structural Readiness** — does the policy / register / procedure file exist in the vault? (Easy to game by writing markdown.)
- **Evidence-Backed Posture** — is there a real artefact in this folder that proves the control is operating? (Hard to game — requires a signed PDF, a screenshot, a training record.)

## What to drop, and where

| Subfolder | What counts as evidence |
|---|---|
| `DPAs/` | Signed Data Processing Agreement PDFs from each processor (Anthropic, Microsoft, Railway, Firefish, Meta WhatsApp). Filename convention: `<processor>-DPA-YYYY-MM-DD.pdf`. |
| `ROPA/` | Signed-off ROPA exports (PDF of the approved Markdown ROPA, dated, with Governor signature). |
| `Classification/` | Governor's signed confirmation of each AI system's risk-tier classification under the EU AI Act. |
| `DPIAs/` | Signed and dated DPIA exports per processing activity. |
| `Transfers/` | Completed Transfer Impact Assessments (PDF), DPF certifications screenshots, SCC executed copies. |
| `Incidents/` | Records of completed tabletop exercises; closed incident reports. |
| `AI Literacy/` | Training-completion records, one per worker, with date and curriculum version. |
| `AI Transparency/` | Screenshots of the first-message AI disclosure on Telegram and WhatsApp; bot profile descriptions. |
| `Worker Notification/` | Counter-signed worker-notification letters under AI Act Art. 26(7). |
| `Log Retention/` | Railway log-retention setting screenshot proving ≥ 6 months. |

**Do not commit** anything that contains personal data. Where the original evidence is sensitive (e.g. a DPA with commercial terms), commit a redacted PDF or a hash + storage-location note instead.
