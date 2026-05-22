---
type: agent
name: Judge Dredd
status: live
owner: Jonathan (Governor)
runs_from: .claude/agents/judge-dredd.md
triggered_by: Manual Governor invocation
last_updated: 2026-05-22
---

# Judge Dredd

## What it does (plain English)

Judge Dredd is the standing project auditor for TRC. It walks every TRC project, lists every AI agent, scheduled job, dataset, and third-party tool, and writes the findings into this vault. It then rebuilds the Word document the audit team reads.

## Where it runs

It is a [[Claude Code]] subagent — a markdown file in `.claude/agents/judge-dredd.md` invoked from a Claude Code session.

## What it touches

- Reads every file in the working repository and any sibling TRC repos the Governor names.
- Writes only inside this vault: `Master Audit.md`, the per-entity notes, `Open Questions.md`, `Change Log.md`, `Dashboard.html`, `TRC-Audit.docx`.
- Sends no data to outside services. Stores no secrets.

## Out of scope

[[Alfred]] / Polymarket — Judge Dredd skips every file, env var, and reference to it.

## Owner

Governor.
