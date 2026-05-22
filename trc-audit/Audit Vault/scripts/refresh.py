#!/usr/bin/env python3
"""Refresh the audit outputs (Word + HTML) from the markdown vault."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run(script: str) -> int:
    cmd = [sys.executable, str(HERE / script)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    return proc.returncode


def main() -> int:
    # Evidence Plan must be built before the dashboard / docx, because they include it.
    rc0 = run("build_evidence_plan.py")
    rc1 = run("build_docx.py")
    rc2 = run("build_dashboard.py")
    return rc0 or rc1 or rc2


if __name__ == "__main__":
    sys.exit(main())
