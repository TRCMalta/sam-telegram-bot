---
type: integration
name: Telegram Bot API
category: messaging
billing_owner: N/A (free tier)
used_by: TRC Telegram bots
last_updated: 2026-05-22
---

# Telegram Bot API

## What it is (plain English)

The interface Telegram provides so an application can read messages sent to a bot account and reply to them. Each bot has a secret token; whoever holds the token controls the bot.

## How TRC uses it

TRC bot accounts (e.g. Sam) receive messages via a [[Webhook]] pointed at the [[Railway]]-hosted server. The bot token sits in an environment variable.

## Why this matters to auditors

The token is a long-lived secret. The audit needs to confirm:

- The token is **only** in Railway's encrypted variables — not in any committed file.
- Telegram **user IDs** allowed to message the bot are explicitly enumerated.
