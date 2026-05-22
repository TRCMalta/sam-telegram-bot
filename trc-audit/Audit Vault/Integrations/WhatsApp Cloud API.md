---
type: integration
name: WhatsApp Cloud API
category: messaging
billing_owner: Unknown — see [[Open Questions]]
used_by: TRC WhatsApp bots
last_updated: 2026-05-22
---

# WhatsApp Cloud API

## What it is (plain English)

Meta's hosted service for sending and receiving WhatsApp messages from a business phone number. Messages arrive at TRC via a [[Webhook]] and the bot replies through Meta's API.

## How TRC uses it

A registered business phone number forwards incoming WhatsApp messages to the [[Railway]]-hosted server. The server checks the sender against an allow-list and routes the conversation to [[Claude]].

## Why this matters to auditors

WhatsApp messages can include personal data. The audit needs to confirm what TRC stores, what it forwards to [[Anthropic]], and how long it keeps it.
