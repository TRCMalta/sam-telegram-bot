#!/usr/bin/env python3
"""Build Dashboard.html — the gamified auditor view.

Shows two scores side by side:
  - Structural Readiness: does the file exist in the vault?
  - Evidence-Backed Posture: is the proof in Compliance/Evidence/?

Plus a "Download Word Report" CTA linking to TRC-Audit.docx.
"""

from __future__ import annotations

import html
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vault import (
    VAULT_ROOT,
    load_assets,
    load_compliance,
    load_root_note,
    compute_score,
)

OUT_HTML = VAULT_ROOT / "Dashboard.html"
CIRCUMFERENCE = 276  # 2 * pi * 44


def asset_card(folder: str, notes) -> str:
    rows = []
    for n in notes:
        status = html.escape(n.frontmatter.get("status", n.frontmatter.get("category", "")))
        owner = html.escape(n.frontmatter.get("owner", "") or n.frontmatter.get("billing_owner", ""))
        rows.append(
            f"<tr><td>{html.escape(n.title)}</td>"
            f"<td>{status}</td><td>{owner}</td></tr>"
        )
    body = "\n".join(rows) if rows else "<tr><td colspan='3' class='muted'>none recorded</td></tr>"
    return (
        f"<section class='card'><h3>{html.escape(folder)}</h3>"
        f"<table><thead><tr><th>Name</th><th>Status</th><th>Owner</th></tr></thead>"
        f"<tbody>{body}</tbody></table></section>"
    )


def compliance_card(folder: str, notes) -> str:
    short = folder.split("/", 1)[-1]
    if not notes:
        body = "<li class='muted'>no entries</li>"
    else:
        body = "\n".join(
            f"<li>{html.escape(n.title)} "
            f"<span class='status'>{html.escape(n.frontmatter.get('status', ''))}</span></li>"
            for n in notes
        )
    return (
        f"<section class='card'><h3>{html.escape(short)}</h3>"
        f"<ul class='compliance-list'>{body}</ul></section>"
    )


def ring(label: str, pct: int, color: str, caption: str) -> str:
    offset = round(CIRCUMFERENCE * (1 - pct / 100))
    return (
        f"<div class='score-tile'>"
        f"<div class='ring'>"
        f"<svg viewBox='0 0 100 100'>"
        f"<circle cx='50' cy='50' r='44' stroke='#2a313c' stroke-width='10' fill='none'/>"
        f"<circle cx='50' cy='50' r='44' stroke='{color}' stroke-width='10' fill='none' "
        f"stroke-dasharray='{CIRCUMFERENCE}' stroke-dashoffset='{offset}' stroke-linecap='round'/>"
        f"</svg>"
        f"<div class='pct'>{pct}%</div>"
        f"</div>"
        f"<h2>{html.escape(label)}</h2>"
        f"<p>{caption}</p>"
        f"</div>"
    )


def colour_for(pct: int) -> str:
    if pct >= 80:
        return "#1f9d55"
    if pct >= 50:
        return "#d97706"
    return "#c0392b"


def main() -> int:
    assets = load_assets()
    compliance = load_compliance()
    open_q = load_root_note("Open Questions.md")
    score = compute_score(assets, compliance, open_q)

    structural_pct = round(score["structural"] * 100)
    evidence_pct = round(score["evidence"] * 100)
    open_q_data = score["open_questions"]

    criteria_html = ""
    for c in score["criteria"]:
        structural = c["structural"] if c["structural"] is not None else 0
        evidence = c["evidence"] if c["evidence"] is not None else 0
        if evidence >= 0.999:
            state = "earned"
        elif structural >= 0.999 and evidence == 0:
            state = "drafted"
        elif structural > 0:
            state = "partial"
        else:
            state = "missing"

        s_pct = round(structural * 100)
        e_pct = round(evidence * 100)
        criteria_html += (
            f"<div class='badge {state}'>"
            f"<div class='badge-icon'>{c['icon']}</div>"
            f"<div class='badge-body'>"
            f"<div class='badge-title'>{html.escape(c['label'])}</div>"
            f"<div class='badge-desc'>{html.escape(c['description'])}</div>"
            f"<div class='dual-bar'>"
            f"<div class='dual-bar-label'>Structural</div>"
            f"<div class='bar'><div class='bar-fill structural' style='width:{s_pct}%'></div></div>"
            f"<div class='dual-bar-value'>{s_pct}%</div>"
            f"</div>"
            f"<div class='dual-bar'>"
            f"<div class='dual-bar-label'>Evidence</div>"
            f"<div class='bar'><div class='bar-fill evidence' style='width:{e_pct}%'></div></div>"
            f"<div class='dual-bar-value'>{e_pct}%</div>"
            f"</div>"
            f"</div></div>"
        )

    counts = score["counts"]
    kpi_html = "".join(
        f"<div class='kpi'><div class='kpi-value'>{v}</div>"
        f"<div class='kpi-label'>{html.escape(k.replace('_', ' '))}</div></div>"
        for k, v in counts.items()
    )

    asset_html = "".join(
        asset_card(folder, notes) for folder, notes in assets.items() if notes
    )
    compliance_html = "".join(
        compliance_card(folder, notes) for folder, notes in compliance.items()
    )

    data_blob = {
        "structural": score["structural"],
        "evidence": score["evidence"],
        "criteria": score["criteria"],
        "counts": counts,
        "open_questions": open_q_data,
        "generated": date.today().isoformat(),
    }

    rings_html = (
        ring("Structural Readiness", structural_pct, colour_for(structural_pct),
             "Does the policy / register / procedure file exist in the vault?")
        + ring("Evidence-Backed Posture", evidence_pct, colour_for(evidence_pct),
               "Is there proof in <code>Compliance/Evidence/</code> that the control is operating?")
    )

    page = HTML_TEMPLATE.format(
        generated=date.today().isoformat(),
        rings_html=rings_html,
        open_answered=open_q_data["answered"],
        open_total=open_q_data["total"],
        kpi_html=kpi_html,
        criteria_html=criteria_html,
        asset_html=asset_html or "<p class='muted'>no assets recorded yet</p>",
        compliance_html=compliance_html or "<p class='muted'>no compliance artefacts yet</p>",
        json_data=html.escape(json.dumps(data_blob, indent=2)),
    )
    OUT_HTML.write_text(page, encoding="utf-8")
    print(f"Wrote {OUT_HTML}")
    return 0


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TRC Audit Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root {{
    --bg: #0e1116;
    --panel: #161b22;
    --panel-2: #1e252e;
    --border: #2a313c;
    --text: #e6edf3;
    --muted: #8b949e;
    --accent: #58a6ff;
    --structural: #58a6ff;
    --evidence: #2ea043;
    --earned: #1f9d55;
    --drafted: #d97706;
    --partial: #d97706;
    --missing: #c0392b;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif; background:var(--bg); color:var(--text); }}
  header {{ padding:32px 40px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }}
  header h1 {{ margin:0; font-size:28px; }}
  header .subtitle {{ color:var(--muted); margin-top:4px; max-width:780px; }}
  header .actions {{ display:flex; gap:12px; }}
  .btn {{ background:var(--accent); color:#0e1116; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:8px; border:none; cursor:pointer; }}
  .btn:hover {{ filter:brightness(1.1); }}
  .btn.secondary {{ background:transparent; color:var(--accent); border:1px solid var(--accent); }}
  main {{ padding:24px 40px 80px; max-width:1400px; margin:0 auto; }}
  .score-row {{ display:grid; grid-template-columns: repeat(2, minmax(220px, 1fr)) 2fr; gap:16px; margin-bottom:32px; }}
  @media (max-width: 1100px) {{ .score-row {{ grid-template-columns:1fr; }} }}
  .score-tile {{ background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:20px; text-align:center; }}
  .score-tile .ring {{ width:160px; height:160px; margin:0 auto 8px; position:relative; }}
  .score-tile .ring svg {{ width:100%; height:100%; transform:rotate(-90deg); }}
  .score-tile .ring .pct {{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:700; }}
  .score-tile h2 {{ margin:8px 0 4px; font-size:16px; }}
  .score-tile p {{ color:var(--muted); margin:0; font-size:12px; }}
  .score-tile code {{ background:var(--panel-2); padding:1px 5px; border-radius:3px; font-size:11px; }}
  .kpi-block {{ background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:16px; }}
  .kpi-block-title {{ font-size:13px; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px; }}
  .kpis {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(110px,1fr)); gap:10px; }}
  .kpi {{ background:var(--panel-2); border:1px solid var(--border); border-radius:8px; padding:12px; text-align:center; }}
  .kpi-value {{ font-size:24px; font-weight:700; color:var(--accent); }}
  .kpi-label {{ color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:0.06em; margin-top:4px; }}
  h2.section-title {{ font-size:18px; margin:32px 0 16px; padding-bottom:6px; border-bottom:1px solid var(--border); }}
  .badges {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(340px,1fr)); gap:16px; }}
  .badge {{ background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:16px; display:flex; gap:14px; align-items:flex-start; }}
  .badge.earned {{ border-color:var(--earned); box-shadow: 0 0 0 1px var(--earned) inset; }}
  .badge.drafted {{ border-color:var(--drafted); }}
  .badge.partial {{ border-color:var(--partial); }}
  .badge.missing {{ border-color:var(--missing); opacity:0.85; }}
  .badge-icon {{ font-size:28px; line-height:1; }}
  .badge-body {{ flex:1; min-width:0; }}
  .badge-title {{ font-weight:700; font-size:14px; }}
  .badge-desc {{ color:var(--muted); font-size:12px; margin:4px 0 10px; line-height:1.4; }}
  .dual-bar {{ display:grid; grid-template-columns: 70px 1fr 36px; gap:6px; align-items:center; margin-top:4px; font-size:11px; }}
  .dual-bar-label {{ color:var(--muted); }}
  .dual-bar-value {{ text-align:right; color:var(--muted); }}
  .bar {{ background:var(--panel-2); height:6px; border-radius:4px; overflow:hidden; }}
  .bar-fill {{ height:100%; border-radius:4px; transition:width 0.4s; }}
  .bar-fill.structural {{ background:var(--structural); }}
  .bar-fill.evidence {{ background:var(--evidence); }}
  .legend {{ display:flex; gap:16px; font-size:12px; color:var(--muted); margin-top:8px; }}
  .legend-dot {{ display:inline-block; width:10px; height:10px; border-radius:50%; vertical-align:middle; margin-right:4px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px; }}
  .card {{ background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:16px; overflow:hidden; }}
  .card h3 {{ margin:0 0 12px; font-size:14px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); }}
  .card table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  .card th, .card td {{ text-align:left; padding:6px 4px; border-bottom:1px solid var(--border); }}
  .card th {{ color:var(--muted); font-weight:500; font-size:11px; text-transform:uppercase; }}
  .compliance-list {{ list-style:none; padding:0; margin:0; font-size:13px; }}
  .compliance-list li {{ padding:6px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; gap:8px; }}
  .compliance-list li:last-child {{ border-bottom:none; }}
  .status {{ color:var(--muted); font-size:11px; }}
  .muted {{ color:var(--muted); font-style:italic; }}
  footer {{ padding:24px 40px; color:var(--muted); font-size:12px; border-top:1px solid var(--border); text-align:center; }}
  details {{ background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:12px 16px; margin-top:24px; }}
  details pre {{ overflow:auto; font-size:11px; color:var(--muted); }}
</style>
</head>
<body>
<header>
  <div>
    <h1>TRC Audit Dashboard</h1>
    <div class="subtitle">Standalone audit programme · jurisdiction: EU (Malta) · GDPR + EU AI Act · Governor: Jonathan.
    Two scores below: <strong>Structural Readiness</strong> = the file exists in the vault.
    <strong>Evidence-Backed Posture</strong> = the proof exists in <code>Compliance/Evidence/</code>.
    The supervisory authority will look at the second one.</div>
  </div>
  <div class="actions">
    <a class="btn" href="TRC-Audit.docx" download>⬇  Download Word Report</a>
    <a class="btn secondary" href="Compliance/Evidence%20Plan.md">View Evidence Plan</a>
    <a class="btn secondary" href="Master Audit.md">Open Master Audit</a>
  </div>
</header>
<main>
  <div class="score-row">
    {rings_html}
    <div class="kpi-block">
      <div class="kpi-block-title">Asset and control counts</div>
      <div class="kpis">{kpi_html}</div>
      <div class="legend">Open questions resolved: <strong>&nbsp;{open_answered}/{open_total}</strong></div>
    </div>
  </div>

  <h2 class="section-title">Compliance Controls</h2>
  <div class="legend">
    <span><span class="legend-dot" style="background:var(--structural)"></span>Structural (file in vault)</span>
    <span><span class="legend-dot" style="background:var(--evidence)"></span>Evidence (proof on file)</span>
    <span><span class="legend-dot" style="background:var(--earned)"></span>Earned</span>
    <span><span class="legend-dot" style="background:var(--drafted)"></span>Drafted, no evidence</span>
    <span><span class="legend-dot" style="background:var(--missing)"></span>Missing</span>
  </div>
  <div class="badges" style="margin-top:12px">{criteria_html}</div>

  <h2 class="section-title">Compliance artefacts</h2>
  <div class="grid">{compliance_html}</div>

  <h2 class="section-title">Asset registers</h2>
  <div class="grid">{asset_html}</div>

  <details>
    <summary>Raw data (machine-readable)</summary>
    <pre>{json_data}</pre>
  </details>
</main>
<footer>
  Generated {generated} by Judge Dredd · TRC standalone audit programme · <strong>Alfred / Polymarket is intentionally excluded</strong>.
</footer>
</body>
</html>
"""


if __name__ == "__main__":
    sys.exit(main())
