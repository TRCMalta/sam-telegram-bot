"""Shared helpers for parsing the TRC Audit Obsidian vault."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

VAULT_ROOT = Path(__file__).resolve().parent.parent

ASSET_FOLDERS = ["Projects", "Agents", "Jobs", "Datasets", "Integrations", "Concepts"]
COMPLIANCE_FOLDERS = [
    "Compliance/01 Records of Processing",
    "Compliance/02 AI System Register",
    "Compliance/03 DPIAs",
    "Compliance/04 International Transfers",
    "Compliance/05 Processors and DPAs",
    "Compliance/06 Data Subject Rights",
    "Compliance/07 Incidents",
    "Compliance/08 Policies",
    "Compliance/09 Notices",
]

OUT_OF_SCOPE_RE = re.compile(r"\balfred\b|\bpolymarket\b", re.IGNORECASE)


@dataclass
class Note:
    folder: str
    path: Path
    title: str
    frontmatter: dict = field(default_factory=dict)
    body: str = ""

    @property
    def type(self) -> str:
        return self.frontmatter.get("type", "")

    @property
    def status(self) -> str:
        return self.frontmatter.get("status", "")

    @property
    def owner(self) -> str:
        return self.frontmatter.get("owner", "")


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block = text[3:end].strip()
    body = text[end + 4:].lstrip("\n")
    data: dict = {}
    for line in block.splitlines():
        line = line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            value = [v.strip().strip('"').strip("'") for v in value[1:-1].split(",") if v.strip()]
        else:
            value = value.strip('"').strip("'")
        data[key] = value
    return data, body


def _load_folder(rel_folder: str) -> list[Note]:
    folder_path = VAULT_ROOT / rel_folder
    if not folder_path.exists():
        return []
    notes = []
    for md in sorted(folder_path.glob("*.md")):
        text = md.read_text(encoding="utf-8")
        # Out-of-scope filter: only the explicit "Alfred" out-of-scope note may mention Alfred.
        if OUT_OF_SCOPE_RE.search(text):
            fm, _ = parse_frontmatter(text)
            if fm.get("category") != "out-of-scope" and "out of scope" not in text.lower()[:1500]:
                continue
        fm, body = parse_frontmatter(text)
        title = fm.get("name") or fm.get("activity") or md.stem
        notes.append(Note(folder=rel_folder, path=md, title=title, frontmatter=fm, body=body))
    return notes


def load_assets() -> dict[str, list[Note]]:
    return {f: _load_folder(f) for f in ASSET_FOLDERS}


def load_compliance() -> dict[str, list[Note]]:
    return {f: _load_folder(f) for f in COMPLIANCE_FOLDERS}


def load_root_note(name: str) -> str:
    path = VAULT_ROOT / name
    return path.read_text(encoding="utf-8") if path.exists() else ""


def count_open_questions(text: str) -> tuple[int, int]:
    total = len(re.findall(r"^\s*-\s*\[[ xX]\]", text, re.MULTILINE))
    answered = len(re.findall(r"^\s*-\s*\[[xX]\]", text, re.MULTILINE))
    return answered, total


def compute_score(assets: dict[str, list[Note]], compliance: dict[str, list[Note]], open_q_text: str) -> dict:
    projects = assets.get("Projects", [])
    ai_agents = assets.get("Agents", [])
    jobs = assets.get("Jobs", [])
    datasets = assets.get("Datasets", [])
    integrations = assets.get("Integrations", [])

    ropas = compliance.get("Compliance/01 Records of Processing", [])
    ai_register = compliance.get("Compliance/02 AI System Register", [])
    dpias = compliance.get("Compliance/03 DPIAs", [])
    transfers = compliance.get("Compliance/04 International Transfers", [])
    processors = compliance.get("Compliance/05 Processors and DPAs", [])
    incidents = compliance.get("Compliance/07 Incidents", [])
    policies = compliance.get("Compliance/08 Policies", [])
    notices = compliance.get("Compliance/09 Notices", [])

    answered, total_q = count_open_questions(open_q_text)

    def filled(notes, predicate):
        if not notes:
            return None
        return sum(1 for n in notes if predicate(n)) / len(notes)

    # Each criterion is a measurable control toward EU compliance posture.
    criteria = [
        {
            "key": "ropa",
            "label": "Recorded",
            "icon": "📒",
            "description": "Every AI system has a paired Record of Processing Activity (GDPR Art. 30).",
            # Templates do not count.
            "progress": (sum(1 for n in ropas if "Template" not in n.path.name) /
                         max(1, len([a for a in ai_agents if a.title != "Judge Dredd"])))
            if ai_agents else None,
        },
        {
            "key": "register",
            "label": "Classified",
            "icon": "🏷",
            "description": "Every AI agent has an entry in the AI System Register with risk classification.",
            "progress": (sum(1 for n in ai_register if "Template" not in n.path.name) /
                         max(1, len(ai_agents))) if ai_agents else None,
        },
        {
            "key": "dpia",
            "label": "Impact Assessed",
            "icon": "🧮",
            "description": "DPIA exists for every high-risk processing activity (GDPR Art. 35 + AI Act Art. 26(9)).",
            "progress": filled(dpias, lambda n: n.path.name not in {"Template.md", "DPIA Trigger Test.md"}),
        },
        {
            "key": "transfers",
            "label": "Transfers Mapped",
            "icon": "🌍",
            "description": "International transfer register exists with at least one TIA per non-adequate recipient.",
            "progress": 1.0 if any("Transfer Register" in n.path.name for n in transfers) else 0.0,
        },
        {
            "key": "processors",
            "label": "Processor DPAs",
            "icon": "🤝",
            "description": "Processor register exists; DPA status tracked per processor.",
            "progress": 1.0 if any("Register" in n.path.name for n in processors) else 0.0,
        },
        {
            "key": "incidents",
            "label": "Incident-Ready",
            "icon": "🚨",
            "description": "72-hour breach procedure (GDPR Art. 33) is in place.",
            "progress": 1.0 if any("Procedure" in n.path.name for n in incidents) else 0.0,
        },
        {
            "key": "literacy",
            "label": "AI-Literate",
            "icon": "📚",
            "description": "AI Literacy Programme is published (AI Act Art. 4, in force).",
            "progress": 1.0 if any("AI Literacy" in n.path.name for n in policies) else 0.0,
        },
        {
            "key": "transparency",
            "label": "Transparent",
            "icon": "🪟",
            "description": "AI Transparency Notice drafted for Art. 50 (2 Aug 2026).",
            "progress": 1.0 if any("AI Transparency" in n.path.name for n in notices) else 0.0,
        },
        {
            "key": "inquisitor",
            "label": "Inquisitor",
            "icon": "📋",
            "description": "All open questions resolved.",
            "progress": (answered / total_q) if total_q else 1.0,
        },
    ]

    measurable = [c for c in criteria if c["progress"] is not None]
    overall = sum(c["progress"] for c in measurable) / len(measurable) if measurable else 0.0

    return {
        "overall": overall,
        "criteria": criteria,
        "counts": {
            "projects": len(projects),
            "agents": len(ai_agents),
            "jobs": len(jobs),
            "datasets": len(datasets),
            "integrations": len(integrations),
            "ropas": len([n for n in ropas if "Template" not in n.path.name]),
            "ai_register": len([n for n in ai_register if "Template" not in n.path.name]),
            "policies": len(policies),
            "notices": len(notices),
        },
        "open_questions": {"answered": answered, "total": total_q},
    }
