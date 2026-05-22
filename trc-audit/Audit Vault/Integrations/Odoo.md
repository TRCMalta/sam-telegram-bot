---
type: integration
name: Odoo
category: business-software
billing_owner: TRC (self-hosted at thinktalent.com.mt)
used_by: Sam
last_updated: 2026-05-22
---

# Odoo

## What it is (plain English)

A business software platform that holds CRM, HR, and accounting records. TRC's Odoo instance is the working system of record for Think Talent. TRC code talks to Odoo over [[JSON-RPC]].

## How TRC uses it

Sam queries Odoo to look up candidates, jobs, contracts, and tasks. Authentication is via an API key tied to a named user.

## Why this matters to auditors

Odoo holds personal data about candidates and staff. The audit must confirm:

- Which Odoo user the API key belongs to and what permissions it has.
- Whether queries are logged.
