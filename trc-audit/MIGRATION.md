# Migration — lift this folder into its own repo

This folder is the **standalone TRC audit programme**. It currently lives inside `TRCMalta/sam-telegram-bot` only because that was the working branch when it was created. Once moved to its own repo, the audit no longer carries Sam's git history or its CI / dependency surface, and the Governor can give the audit team read access to **just the audit** without exposing Sam's source.

## One-time migration

You will need:

- Write access to `TRCMalta` on GitHub.
- Local `git` installed.
- About 5 minutes.

### Step 1 — Create the empty repo

In GitHub (or via `gh`):

- Owner: `TRCMalta`
- Name: `trc-audit`
- Visibility: **Private**
- Initialise: no README, no .gitignore (this folder ships with both).

### Step 2 — Copy this folder into the new repo

From any machine with this branch checked out:

```bash
# 1. Clone the empty repo somewhere fresh
git clone git@github.com:TRCMalta/trc-audit.git ~/trc-audit
cd ~/trc-audit

# 2. Copy the contents of trc-audit/ from sam-telegram-bot
cp -a /path/to/sam-telegram-bot/trc-audit/. .

# 3. First commit
git add -A
git commit -m "initial commit: TRC standalone audit programme"
git push -u origin main
```

### Step 3 — Remove the duplicate from sam-telegram-bot

Once you have confirmed the new repo is healthy:

```bash
cd /path/to/sam-telegram-bot
git rm -r trc-audit
git commit -m "chore: move audit programme to standalone TRCMalta/trc-audit"
git push
```

### Step 4 — Open the new repo in Claude Code

From a Claude Code on the Web session (or any Claude Code surface), open `TRCMalta/trc-audit`. The subagent at `.claude/agents/judge-dredd.md` will be discovered automatically.

Run the first refresh:

```
/agent judge-dredd Initial run from the new standalone repo. Confirm everything still resolves.
```

If anything 404s, fix the path in the affected note and re-run.

## What does NOT move

- **Sam's source code** stays in `TRCMalta/sam-telegram-bot`. It is an *audited* asset, not part of the audit programme.
- **Alfred** stays out of scope. The audit programme never imports or references it.

## Verification checklist

After migration, confirm:

- [ ] `TRCMalta/trc-audit` exists and is **private**.
- [ ] `Audit Vault/Dashboard.html` opens in a browser and shows both score rings.
- [ ] `Audit Vault/TRC-Audit.docx` opens in Word and includes the Compliance Posture, Master Audit, all compliance artefacts, asset registers, Open Questions, and Change Log.
- [ ] `python3 "Audit Vault/scripts/refresh.py"` runs without error and regenerates both outputs.
- [ ] `/agent judge-dredd` is recognised in a Claude Code session opened on the new repo.
- [ ] The audit team has been invited as **read-only** collaborators to `TRCMalta/trc-audit` — not to `TRCMalta/sam-telegram-bot`.

When all six are ticked, the audit programme is officially standalone.
