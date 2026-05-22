---
type: integration
name: Anthropic
category: ai
billing_owner: Unknown — see [[Open Questions]]
used_by: All TRC AI agents
last_updated: 2026-05-22
---

# Anthropic

## What it is (plain English)

The company that makes [[Claude]], the AI model TRC projects send messages to. Access is via an API key billed per use.

## How TRC uses it

Every TRC AI agent — Sam, [[Judge Dredd]], and any future agent — sends conversation text to Anthropic and receives a generated reply.

## Why this matters to auditors

Text sent to Anthropic leaves TRC's perimeter. The audit must confirm:

- Which conversations are sent (and which are not).
- Whether [[Anthropic]]'s data-retention setting matches TRC policy.
- Who pays the bill.
