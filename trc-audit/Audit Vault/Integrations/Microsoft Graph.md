---
type: integration
name: Microsoft Graph
category: productivity
billing_owner: TRC Microsoft 365 tenant
used_by: Sam
last_updated: 2026-05-22
---

# Microsoft Graph

## What it is (plain English)

Microsoft's API for reading and writing Outlook mail, Teams chats, OneDrive files, and calendar entries on behalf of a user. Access is via an Azure AD application registered in TRC's Microsoft 365 tenant.

## How TRC uses it

Sam reads Beverly's calendar, mailbox, and (where permitted) Teams chats to answer Chief-of-Staff questions and draft replies.

## Why this matters to auditors

This is the most sensitive integration in the stack — it can read mail. The audit must confirm:

- Which permissions (scopes) the app is granted.
- Which mailboxes it can access.
- Whether the app secret is rotated on a schedule.
