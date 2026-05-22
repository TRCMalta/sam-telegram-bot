---
type: integration
name: Railway
category: hosting
billing_owner: Unknown — see [[Open Questions]]
used_by: TRC bots and APIs
last_updated: 2026-05-22
---

# Railway

## What it is (plain English)

A cloud hosting service. Code is pushed to Railway and Railway runs it on the internet so the app or bot is always reachable. Railway also handles deployment, environment variables, and basic logs.

## How TRC uses it

Hosts the always-on bots and APIs (e.g. Sam on Telegram and WhatsApp). When the Governor pushes new code to the connected GitHub branch, Railway rebuilds and redeploys automatically.

## Why this matters to auditors

Anything running on Railway can read the environment variables Railway stores. The audit needs the **billing-account holder** and a list of **which TRC projects share the Railway workspace**.

## Open questions

See [[Open Questions]] → "Who is the billing-account holder for Railway?"
