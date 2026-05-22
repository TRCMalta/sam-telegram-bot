---
type: concept
name: Webhook
last_updated: 2026-05-22
---

# Webhook

A web address the project exposes so an outside service (like [[Telegram Bot API|Telegram]] or [[WhatsApp Cloud API|WhatsApp]]) can push events to it the moment they happen, instead of the project having to poll. The outside service must know the URL and, ideally, send a shared-secret header so the receiver can confirm the call is genuine.
