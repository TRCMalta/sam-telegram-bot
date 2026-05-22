#!/usr/bin/env python3
"""Build Dashboard.html — the gamified auditor view.

Reads the vault, computes compliance KPIs, and writes a self-contained
HTML file with KPI cards, badges, progress bars, and a "Download Word
Report" button that links to TRC-Audit.docx.
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


def main() -> int:
    assets = load_assets()
    compliance = load_compliance()
    open_q = load_root_note("Open Questions.md")
    score = compute_score(assets, compliance, open_q)

    overall_pct = round(score["overall"] * 100)
    open_q_data = score["open_questions"]

    criteria_html = ""
    for c in score["criteria"]:
        progress = c["progress"]
        if progress is None:
            bar_width = 0
            label = "n/a"
            earned = "pending"
        else:
            bar_width = round(progress * 100)
            label = f"{bar_width}%"
            earned = "earned" if progress >= 0.999 else ("partial" if progress > 0 else "missing")
        criteria_html += (
            f"<div class='badge {earned}'>"
            f"<div class='badge-icon'>{c['icon']}</div>"
            f"<div class='badge-body'>"
            f"<div class='badge-title'>{html.escape(c['label'])}</div>"
            f"<div class='badge-desc'>{html.escape(c['description'])}</div>"
            f"<div class='bar'><div class='bar-fill' style='width:{bar_width}%'></div></div>"
            f"<div class='bar-label'>{label}</div>"
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
        "overall": score["overall"],
        "criteria": [
            {k: v for k, v in c.items() if k != "progress"} | {"progress": c["progress"]}
            for c in score["criteria"]
        ],
        "counts": counts,
        "open_questions": open_q_data,
        "generated": date.today().isoformat(),
    }

    circumference = 276  # 2*pi*44
    stroke_offset = round(circumference * (1 - score["overall"]))
    page = HTML_TEMPLATE.format(
        generated=date.today().isoformat(),
        overall_pct=overall_pct,
        overall_color="#1f9d55" if overall_pct >= 80 else ("#d97706" if overall_pct >= 50 else "#c0392b"),
        stroke_offset=stroke_offset,
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
    --earned: #1f9d55;
    --partial: #d97706;
    --missing: #c0392b;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif; background:var(--bg); color:var(--text); }}
  header {{ padding:32px 40px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; }}
  header h1 {{ margin:0; font-size:28px; }}
  header .subtitle {{ color:var(--muted); margin-top:4px; }}
  header .actions {{ display:flex; gap:12px; }}
  .btn {{ background:var(--accent); color:#0e1116; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:8px; border:none; cursor:pointer; }}
  .btn:hover {{ filter:brightness(1.1); }}
  .btn.secondary {{ background:transparent; color:var(--accent); border:1px solid var(--accent); }}
  main {{ padding:24px 40px 80px; max-width:1400px; margin:0 auto; }}
  .score-row {{ display:grid; grid-template-columns: 320px 1fr; gap:24px; margin-bottom:32px; }}
  @media (max-width: 900px) {{ .score-row {{ grid-template-columns:1fr; }} }}
  .score-tile {{ background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:24px; text-align:center; }}
  .score-tile .ring {{ width:180px; height:180px; margin:0 auto 12px; position:relative; }}
  .score-tile .ring svg {{ width:100%; height:100%; transform:rotate(-90deg); }}
  .score-tile .ring .pct {{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:36px; font-weight:700; }}
  .score-tile h2 {{ margin:8px 0 4px; font-size:18px; }}
  .score-tile p {{ color:var(--muted); margin:0; font-size:13px; }}
  .kpis {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(140px,1fr)); gap:12px; }}
  .kpi {{ background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:18px; text-align:center; }}
  .kpi-value {{ font-size:30px; font-weight:700; color:var(--accent); }}
  .kpi-label {{ color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0.06em; margin-top:6px; }}
  h2.section-title {{ font-size:18px; margin:32px 0 16px; padding-bottom:6px; border-bottom:1px solid var(--border); }}
  .badges {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); gap:16px; }}
  .badge {{ background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:16px; display:flex; gap:14px; align-items:flex-start; }}
  .badge.earned {{ border-color:var(--earned); box-shadow: 0 0 0 1px var(--earned) inset; }}
  .badge.partial {{ border-color:var(--partial); }}
  .badge.missing {{ border-color:var(--missing); opacity:0.85; }}
  .badge.pending {{ opacity:0.5; }}
  .badge-icon {{ font-size:32px; line-height:1; }}
  .badge-body {{ flex:1; min-width:0; }}
  .badge-title {{ font-weight:700; }}
  .badge-desc {{ color:var(--muted); font-size:13px; margin:4px 0 8px; }}
  .bar {{ background:var(--panel-2); height:6px; border-radius:4px; overflow:hidden; }}
  .bar-fill {{ background:var(--accent); height:100%; border-radius:4px; transition:width 0.4s; }}
  .badge.earned .bar-fill {{ background:var(--earned); }}
  .badge.partial .bar-fill {{ background:var(--partial); }}
  .badge.missing .bar-fill {{ background:var(--missing); }}
  .bar-label {{ font-size:11px; color:var(--muted); margin-top:2px; }}
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
    <div class="subtitle">Standalone audit programme · jurisdiction: EU (Malta) · GDPR + EU AI Act · Governor: Jonathan</div>
  </div>
  <div class="actions">
    <a class="btn" href="TRC-Audit.docx" download>⬇  Download Word Report</a>
    <a class="btn secondary" href="Master Audit.md">Open Master Audit</a>
  </div>
</header>
<main>
  <div class="score-row">
    <div class="score-tile">
      <div class="ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" stroke="#2a313c" stroke-width="10" fill="none"/>
          <circle cx="50" cy="50" r="44" stroke="{overall_color}" stroke-width="10" fill="none"
            stroke-dasharray="276" stroke-dashoffset="{stroke_offset}" stroke-linecap="round"/>
        </svg>
        <div class="pct">{overall_pct}%</div>
      </div>
      <h2>Compliance Posture Score</h2>
      <p>Weighted average across the controls below.<br>Open questions: <strong>{open_answered}/{open_total}</strong> resolved.</p>
    </div>
    <div>
      <h2 class="section-title">Asset and control counts</h2>
      <div class="kpis">{kpi_html}</div>
    </div>
  </div>

  <h2 class="section-title">Compliance Badges</h2>
  <div class="badges">{criteria_html}</div>

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
<script>
  // Animate the ring after load
  document.addEventListener('DOMContentLoaded', () => {{
    const fill = document.querySelector('.score-tile circle:nth-of-type(2)');
    if (fill) {{
      const target = fill.getAttribute('stroke-dashoffset');
      fill.setAttribute('stroke-dashoffset', '276');
      requestAnimationFrame(() => {{ setTimeout(() => fill.setAttribute('stroke-dashoffset', target), 60); }});
    }}
  }});
</script>
</body>
</html>
"""


if __name__ == "__main__":
    sys.exit(main())
