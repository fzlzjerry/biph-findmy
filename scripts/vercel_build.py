"""Vercel build step (pyproject.toml → [tool.vercel.scripts] build).

Runs after Vercel has installed the Python dependencies and before the function is bundled:

1. download the pinned multilingual embedding model into matcher/models/ (bundled with the
   function, so production never calls Hugging Face at runtime);
2. build the React frontend into frontend/dist/ (app.frontend() → promoted to Vercel's CDN).

    python scripts/vercel_build.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import fetch_model  # noqa: E402


def step(title: str) -> float:
    print(f"\n▶ {title}", flush=True)
    return time.monotonic()


def run(cmd: list[str], cwd: Path) -> None:
    print("$ " + " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def main() -> int:
    started = step("Embedding model")
    if fetch_model.main() != 0:
        return 1
    print(f"  done in {time.monotonic() - started:.0f}s")

    started = step("Frontend")
    npm = shutil.which("npm")
    if npm is None:
        print("✗ npm not found in the build image", file=sys.stderr)
        return 1
    frontend = ROOT / "frontend"
    run([npm, "ci", "--no-audit", "--no-fund"], frontend)
    run([npm, "run", "build"], frontend)
    if not (frontend / "dist" / "index.html").is_file():
        print("✗ frontend/dist/index.html missing after build", file=sys.stderr)
        return 1
    print(f"  done in {time.monotonic() - started:.0f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
