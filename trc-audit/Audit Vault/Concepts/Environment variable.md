---
type: concept
name: Environment variable
aliases: [".env", "env var"]
last_updated: 2026-05-22
---

# Environment variable

A named setting or secret loaded by an application when it starts — for example an API key. Stored **outside** the source code so the secret is not committed to GitHub. In TRC, environment variables live in [[Railway]] for production and in a local `.env` file for development. The `.env` file is in `.gitignore` and never committed.
