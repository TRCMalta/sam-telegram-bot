---
type: integration
name: Claude
category: ai
billing_owner: See [[Anthropic]]
used_by: All TRC AI agents
last_updated: 2026-05-22
---

# Claude

## What it is (plain English)

[[Anthropic]]'s AI assistant. TRC sends user messages to Claude and forwards the reply back through Telegram, WhatsApp, or another channel.

## How TRC uses it

The TRC bot servers call Claude with each user message plus a system prompt that defines the agent's role (e.g. Sam as Chief of Staff).

## Why this matters to auditors

The model version, system prompt, and any tool use determine what the agent can do. The audit should pin which Claude model each TRC agent uses and when it last changed.
