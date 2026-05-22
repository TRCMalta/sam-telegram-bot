# Monthly Audit Runbook — for the Governor

> Total time budget: **30–45 minutes** once a month. The first run after a material change (new project, new agent) takes longer.

## Before you start

1. Open Claude Code in this repository (after migration: `TRCMalta/trc-audit`).
2. Confirm `audit_targets.md` is up to date — add any new project / repo / agent / job / dataset / integration that came online since last month. **Do not add Alfred.**
3. Confirm your name and email are still correct at the top of `Audit Vault/Master Audit.md` and `Audit Vault/Compliance Posture.md`.

## Step 1 — Invoke Judge Dredd

In Claude Code:

```
/agent judge-dredd Run the monthly check. Today's audit_targets.md is current.
```

Judge Dredd will:

- Read `audit_targets.md`.
- Walk each listed asset and update its note in `Audit Vault/`.
- Diff against last month — anything added, changed, retired.
- Update the per-asset notes, the AI System Register, ROPAs, Transfer Register, Processor Register.
- Re-classify any AI system whose data flow has changed (Annex III re-check).
- Append a `Change Log.md` line.
- Carry every unanswered `Open Questions.md` item forward.
- Regenerate `Dashboard.html` and `TRC-Audit.docx`.
- Report back with what changed and what needs your decision.

## Step 2 — Open the dashboard

Open `Audit Vault/Dashboard.html` in any browser.

Two scores at the top:

- **Structural Readiness** — does the file exist in the vault? (Drafts count.)
- **Evidence-Backed Posture** — is there proof in `Audit Vault/Compliance/Evidence/`?

The supervisory authority will look at the second one. Aim to lift the Evidence score above 80% within 12 months.

## Step 3 — Close the loop on evidence

For every badge that is **drafted but not evidenced**, drop the proof into the matching `Audit Vault/Compliance/Evidence/<subfolder>/`:

| Badge | Evidence needed | Drop into |
|---|---|---|
| 🤝 Processor DPAs | signed DPA PDF per vendor | `Evidence/DPAs/` |
| 📒 Recorded (ROPA) | signed-off ROPA export | `Evidence/ROPA/` |
| 🏷 Classified | Governor's signed risk classification | `Evidence/Classification/` |
| 🧮 Impact Assessed (DPIA) | signed DPIA export | `Evidence/DPIAs/` |
| 🌍 Transfers Mapped | completed TIA per non-EU recipient | `Evidence/Transfers/` |
| 🚨 Incident-Ready | tabletop-exercise record | `Evidence/Incidents/` |
| 📚 AI-Literate | training-completion record per worker | `Evidence/AI Literacy/` |
| 🪟 Transparent | screenshot of disclosure live on Telegram + WhatsApp | `Evidence/AI Transparency/` |
| ✍️ Workers Informed | counter-signed worker notice | `Evidence/Worker Notification/` |
| 💾 Logs Retained | Railway retention-setting screenshot | `Evidence/Log Retention/` |

Re-run Judge Dredd to recompute the score after dropping new evidence:

```
/agent judge-dredd Re-score with the new evidence I just added.
```

## Step 4 — Decide on Open Questions

Open `Audit Vault/Open Questions.md`. For every unticked box:

- If you have the answer, tick the box and record the answer in the relevant artefact (ROPA / Processor entry / Classification).
- If the answer needs an external party (e.g. confirm Anthropic's DPF status), keep the box open and assign yourself a follow-up.

## Step 5 — Distribute the Word report

The fresh `TRC-Audit.docx` is in `Audit Vault/`. Either:

- email it to the audit team, **or**
- click the **Download Word Report** button on the dashboard.

If the audit team has questions, log them as new items in `Open Questions.md` so they survive into next month's review.

## Step 6 — Commit

```
git add -A
git commit -m "audit: monthly refresh YYYY-MM"
git push
```

The Governor reviews the diff before pushing. **No commit happens without the Governor.**

---

## Crisis runbook (off-cycle)

If something material happens **between** monthly checks — new project goes live, processor changes terms, an incident is detected — run Judge Dredd immediately:

```
/agent judge-dredd Refresh because <reason>. Add: <new thing> | Change: <changed thing> | Retire: <retired thing>.
```

For a **personal data breach**, also open `Audit Vault/Compliance/07 Incidents/Procedure.md` and start the 72-hour notification clock.
