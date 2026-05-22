#!/usr/bin/env python3
"""Build Audit Vault/Compliance/Evidence Plan.md.

For every audited project, lists — per control — the exact physical
artefact that must exist for the project to hit 100% on both
Structural Readiness and Evidence-Backed Posture.

Audited projects = every AI agent registered in `Audit Vault/Agents/`
(except Judge Dredd, which has no personal-data processing) plus every
non-AI project in `Audit Vault/Projects/`. Alfred is excluded.
"""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vault import VAULT_ROOT, load_assets, load_compliance, OUT_OF_SCOPE_RE, parse_frontmatter

OUT_FILE = VAULT_ROOT / "Compliance" / "Evidence Plan.md"
EVIDENCE_DIR = VAULT_ROOT / "Compliance" / "Evidence"


def project_artefact_exists(folder_rel: str, project: str) -> tuple[bool, str]:
    """Return (exists?, actual path or expected path) for a project artefact.

    Matches in this order:
      1. Exact stem `<project>.md`
      2. Stem starting with `<project> `
      3. Frontmatter `activity:` or `name:` equal to project
      4. Frontmatter `activity:` or `name:` containing project as a word
    """
    folder = VAULT_ROOT / folder_rel
    expected = f"{folder_rel}/{project}.md"
    if not folder.exists():
        return False, expected

    exact = folder / f"{project}.md"
    if exact.exists():
        return True, f"{folder_rel}/{project}.md"

    for md in folder.glob("*.md"):
        if md.name in {"Template.md", "TIA Template.md", "DPIA Trigger Test.md", "Register.md", "Transfer Register.md", "Procedure.md"}:
            continue
        if md.stem.lower().startswith(project.lower() + " "):
            return True, f"{folder_rel}/{md.name}"
        try:
            fm, _ = parse_frontmatter(md.read_text(encoding="utf-8"))
        except Exception:
            continue
        candidates = {(fm.get("activity") or ""), (fm.get("name") or ""), (fm.get("subject") or "")}
        for cand in candidates:
            if not cand:
                continue
            if cand.lower() == project.lower():
                return True, f"{folder_rel}/{md.name}"
            if re.search(rf"\b{re.escape(project)}\b", cand, re.IGNORECASE):
                return True, f"{folder_rel}/{md.name}"
    return False, expected


# Each control row carries either:
#   - a `project_folder` (resolved by project_artefact_exists, which matches by
#     filename, prefix, or frontmatter activity/name/subject), OR
#   - a `structural_rel` (a fixed path that doesn't vary per project).
CONTROLS = [
    {
        "key": "ai_register",
        "label": "AI System Register entry",
        "project_folder": "Compliance/02 AI System Register",
        "evidence_subfolder": "Classification",
        "evidence_filename_hint": "<project>-classification-signed-YYYY-MM-DD.pdf",
        "article": "AI Act Art. 6 + Annex III",
        "what_is_needed": (
            "Risk-tier classification confirmed in writing by the Governor. "
            "If high-risk, the full Article 26 stack applies."
        ),
    },
    {
        "key": "ropa",
        "label": "Record of Processing Activity",
        "project_folder": "Compliance/01 Records of Processing",
        "evidence_subfolder": "ROPA",
        "evidence_filename_hint": "<project>-ROPA-signed-YYYY-MM-DD.pdf",
        "article": "GDPR Art. 30",
        "what_is_needed": (
            "PDF of the approved ROPA, dated and signed by the Governor."
        ),
    },
    {
        "key": "dpia",
        "label": "DPIA",
        "project_folder": "Compliance/03 DPIAs",
        "evidence_subfolder": "DPIAs",
        "evidence_filename_hint": "<project>-DPIA-signed-YYYY-MM-DD.pdf",
        "article": "GDPR Art. 35 + AI Act Art. 26(9)",
        "what_is_needed": (
            "Signed DPIA. Required where high-risk processing or high-risk AI is involved."
        ),
    },
    {
        "key": "dpa_anthropic",
        "label": "DPA — Anthropic",
        "structural_rel": lambda p: "Compliance/05 Processors and DPAs/Register.md",
        "evidence_subfolder": "DPAs",
        "evidence_filename_hint": "Anthropic-DPA-YYYY-MM-DD.pdf",
        "article": "GDPR Art. 28",
        "what_is_needed": (
            "Counter-signed Anthropic Data Processing Agreement. "
            "Required for any project that sends text to Claude."
        ),
        "only_if": lambda integrations: "Anthropic" in integrations or "Claude" in integrations,
    },
    {
        "key": "dpa_microsoft",
        "label": "DPA — Microsoft",
        "structural_rel": lambda p: "Compliance/05 Processors and DPAs/Register.md",
        "evidence_subfolder": "DPAs",
        "evidence_filename_hint": "Microsoft-DPA-YYYY-MM-DD.pdf",
        "article": "GDPR Art. 28",
        "what_is_needed": "Microsoft Online Services DPA (Product Terms). Required if the project uses Microsoft Graph.",
        "only_if": lambda integrations: "Microsoft Graph" in integrations or "Microsoft" in integrations,
    },
    {
        "key": "dpa_railway",
        "label": "DPA — Railway",
        "structural_rel": lambda p: "Compliance/05 Processors and DPAs/Register.md",
        "evidence_subfolder": "DPAs",
        "evidence_filename_hint": "Railway-DPA-YYYY-MM-DD.pdf",
        "article": "GDPR Art. 28",
        "what_is_needed": "Counter-signed Railway DPA. Required for any project hosted on Railway.",
        "only_if": lambda integrations: "Railway" in integrations,
    },
    {
        "key": "tia_us",
        "label": "Transfer Impact Assessment (US processors)",
        "structural_rel": lambda p: "Compliance/04 International Transfers/Transfer Register.md",
        "evidence_subfolder": "Transfers",
        "evidence_filename_hint": "<recipient>-TIA-YYYY-MM-DD.pdf",
        "article": "GDPR Chapter V",
        "what_is_needed": (
            "Completed Transfer Impact Assessment per non-adequate recipient (Anthropic, Microsoft, Railway, Meta WhatsApp where applicable). "
            "Either DPF certification screenshot or executed SCCs."
        ),
        "only_if": lambda integrations: any(
            i in integrations for i in ("Anthropic", "Claude", "Microsoft Graph", "Microsoft", "Railway", "WhatsApp Cloud API")
        ),
    },
    {
        "key": "incident",
        "label": "Incident-response readiness",
        "structural_rel": lambda p: "Compliance/07 Incidents/Procedure.md",
        "evidence_subfolder": "Incidents",
        "evidence_filename_hint": "tabletop-YYYY-MM-DD.md",
        "article": "GDPR Art. 33",
        "what_is_needed": "Record of an annual tabletop exercise that walks through the 72-hour notification.",
    },
    {
        "key": "ai_literacy",
        "label": "AI literacy (per worker using this AI)",
        "structural_rel": lambda p: "Compliance/08 Policies/AI Literacy Programme.md",
        "evidence_subfolder": "AI Literacy",
        "evidence_filename_hint": "<worker-name>-literacy-YYYY-MM-DD.pdf",
        "article": "AI Act Art. 4 (in force)",
        "what_is_needed": "One training-completion record per worker who uses or oversees this AI system.",
        "only_if_type": "agent",  # only for AI agents
    },
    {
        "key": "transparency",
        "label": "AI transparency notice live",
        "structural_rel": lambda p: "Compliance/09 Notices/AI Transparency Notice.md",
        "evidence_subfolder": "AI Transparency",
        "evidence_filename_hint": "<project>-disclosure-screenshot-YYYY-MM-DD.png",
        "article": "AI Act Art. 50 (effective 2 Aug 2026)",
        "what_is_needed": (
            "Screenshot of the first-message AI disclosure live on the channel(s) the project uses. "
            "Plus screenshot of the bot profile description."
        ),
        "only_if_type": "agent",
    },
    {
        "key": "worker_notice",
        "label": "Worker notification served",
        "structural_rel": lambda p: "Compliance/09 Notices/Worker Notification.md",
        "evidence_subfolder": "Worker Notification",
        "evidence_filename_hint": "<worker-name>-acknowledgment-YYYY-MM-DD.pdf",
        "article": "AI Act Art. 26(7) (effective 2 Aug 2026)",
        "what_is_needed": (
            "Counter-signed worker notification from every worker whose data the AI can read. "
            "Required only for high-risk AI."
        ),
        "only_if_type": "agent",
    },
    {
        "key": "log_retention",
        "label": "Logs retained ≥ 6 months",
        "structural_rel": lambda p: f"Compliance/02 AI System Register/{p}.md",
        "evidence_subfolder": "Log Retention",
        "evidence_filename_hint": "<project>-log-retention-screenshot-YYYY-MM-DD.png",
        "article": "AI Act Art. 26(6) (effective 2 Aug 2026)",
        "what_is_needed": (
            "Screenshot from the hosting provider (e.g. Railway) showing the log-retention setting is ≥ 6 months."
        ),
        "only_if_type": "agent",
    },
]


def evidence_present(subfolder: str, hint: str | None = None) -> bool:
    p = EVIDENCE_DIR / subfolder
    if not p.exists() or not p.is_dir():
        return False
    for f in p.iterdir():
        if f.name in {".gitkeep", "README.md"}:
            continue
        return True
    return False


def structural_present_exact(rel_path: str) -> bool:
    return (VAULT_ROOT / rel_path).exists()


def project_integrations(note) -> set[str]:
    """Extract integration names referenced in the body of a project/agent note."""
    body = note.body or ""
    integrations = set()
    for tool in (
        "Anthropic", "Claude", "Railway", "Microsoft Graph", "Microsoft",
        "Telegram Bot API", "WhatsApp Cloud API", "Odoo", "Firefish"
    ):
        if tool in body:
            integrations.add(tool)
    return integrations


def render_project_section(name: str, project_type: str, integrations: set[str]) -> tuple[str, int, int, int, int]:
    structural_ok = 0
    structural_total = 0
    evidence_ok = 0
    evidence_total = 0

    rows = []
    for c in CONTROLS:
        if "only_if" in c and not c["only_if"](integrations):
            continue
        if "only_if_type" in c and c["only_if_type"] != project_type:
            continue

        if "project_folder" in c:
            s_ok, structural_path = project_artefact_exists(c["project_folder"], name)
        else:
            structural_path = c["structural_rel"](name)
            s_ok = structural_present_exact(structural_path)
        e_ok = evidence_present(c["evidence_subfolder"])
        s_mark = "✅" if s_ok else "❌"
        e_mark = "✅" if e_ok else "❌"

        structural_total += 1
        evidence_total += 1
        if s_ok:
            structural_ok += 1
        if e_ok:
            evidence_ok += 1

        rows.append(
            f"| **{c['label']}** | {c['article']} | "
            f"{s_mark} `{structural_path}` | "
            f"{e_mark} `Compliance/Evidence/{c['evidence_subfolder']}/{c['evidence_filename_hint']}` | "
            f"{c['what_is_needed']} |"
        )

    score_s = f"{structural_ok}/{structural_total}" if structural_total else "n/a"
    score_e = f"{evidence_ok}/{evidence_total}" if evidence_total else "n/a"
    header = f"### {name}\n\n_Type: {project_type}_  ·  Structural: **{score_s}**  ·  Evidence: **{score_e}**\n"

    if not rows:
        body = "_No controls apply (project does not trigger any audited obligation). Confirm with the Governor._"
    else:
        body = (
            "| Control | Article | Structural file (must exist) | Evidence file (must be dropped) | What the artefact is |\n"
            "|---|---|---|---|---|\n"
            + "\n".join(rows)
        )
    return f"{header}\n{body}\n", structural_ok, structural_total, evidence_ok, evidence_total


def main() -> int:
    assets = load_assets()

    agents = [n for n in assets.get("Agents", []) if n.title != "Judge Dredd"]
    projects = assets.get("Projects", [])

    # If there are no Projects/ notes but Sam appears as an AI System Register entry,
    # we still want it included as an agent project. Build the list from the union.
    register = (VAULT_ROOT / "Compliance" / "02 AI System Register").glob("*.md")
    register_titles = {p.stem for p in register if p.name not in {"Template.md"}}

    audited: list[tuple[str, str, set[str]]] = []

    seen = set()
    for n in agents:
        if OUT_OF_SCOPE_RE.search(n.title):
            continue
        if n.title in seen:
            continue
        seen.add(n.title)
        audited.append((n.title, "agent", project_integrations(n)))

    for title in sorted(register_titles - seen):
        if OUT_OF_SCOPE_RE.search(title):
            continue
        seen.add(title)
        # Pull integrations from the AISR body if present
        path = VAULT_ROOT / "Compliance" / "02 AI System Register" / f"{title}.md"
        body = path.read_text(encoding="utf-8") if path.exists() else ""
        integrations = set()
        for tool in (
            "Anthropic", "Claude", "Railway", "Microsoft Graph", "Microsoft",
            "Telegram Bot API", "WhatsApp Cloud API", "Odoo", "Firefish"
        ):
            if tool in body:
                integrations.add(tool)
        audited.append((title, "agent", integrations))

    for n in projects:
        if OUT_OF_SCOPE_RE.search(n.title) or n.title in seen:
            continue
        seen.add(n.title)
        audited.append((n.title, "project", project_integrations(n)))

    sections = []
    grand_s_ok = grand_s_tot = grand_e_ok = grand_e_tot = 0
    for name, ptype, integrations in audited:
        section, s_ok, s_tot, e_ok, e_tot = render_project_section(name, ptype, integrations)
        sections.append(section)
        grand_s_ok += s_ok
        grand_s_tot += s_tot
        grand_e_ok += e_ok
        grand_e_tot += e_tot

    def pct(num, denom):
        return round(100 * num / denom) if denom else 0

    summary = (
        f"## Summary\n\n"
        f"- **Projects audited:** {len(audited)}\n"
        f"- **Structural readiness across all projects:** {grand_s_ok} of {grand_s_tot} required files in place "
        f"(**{pct(grand_s_ok, grand_s_tot)}%**).\n"
        f"- **Evidence-backed posture across all projects:** {grand_e_ok} of {grand_e_tot} required artefacts on file "
        f"(**{pct(grand_e_ok, grand_e_tot)}%**).\n"
    )

    body = (
        f"---\n"
        f"type: evidence-plan\n"
        f"last_updated: {date.today().isoformat()}\n"
        f"generated_by: scripts/build_evidence_plan.py\n"
        f"---\n\n"
        f"# Evidence Plan — per project, per control\n\n"
        f"> Generated. **Do not hand-edit** — rerun `python3 \"Audit Vault/scripts/build_evidence_plan.py\"` "
        f"(or the umbrella `scripts/refresh.py`) instead. For every audited project, this is the **exact list "
        f"of physical artefacts** the Governor must produce — and where they must live — for both Structural "
        f"Readiness and Evidence-Backed Posture to read 100% on the dashboard. **Alfred / Polymarket is excluded.**\n\n"
        f"## Legend\n\n"
        f"- **Structural file** — the markdown file that must exist in the vault. Either Judge Dredd writes it on the next refresh, or the Governor writes it manually.\n"
        f"- **Evidence file** — the proof artefact the Governor drops into `Audit Vault/Compliance/Evidence/<subfolder>/`. Until something is there, the evidence column is ❌.\n"
        f"- ✅ = present, ❌ = missing.\n\n"
        f"{summary}\n"
        f"## Per-project plan\n\n"
        + "\n".join(sections)
    )

    OUT_FILE.write_text(body, encoding="utf-8")
    print(f"Wrote {OUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
