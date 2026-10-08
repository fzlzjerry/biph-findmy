"""Execute the Data Science Club notebooks in place, so their outputs render on GitHub.

    uv run python scripts/run_notebooks.py          # all of matcher/notebooks/*.ipynb
    uv run python scripts/run_notebooks.py 02       # only notebooks whose file name contains "02"

Needs the embedding model (make model); notebook 02 also downloads multilingual-e5-small (118 MB).
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOKS = ROOT / "matcher" / "notebooks"


def main() -> int:
    filters = sys.argv[1:]
    for path in sorted(NOTEBOOKS.glob("*.ipynb")):
        if filters and not any(f in path.name for f in filters):
            continue
        nb = nbformat.read(path, as_version=4)
        started = time.monotonic()
        NotebookClient(nb, timeout=1200, kernel_name="python3",
                       resources={"metadata": {"path": str(ROOT)}}).execute()
        nbformat.write(nb, path)
        print(f"✓ {path.relative_to(ROOT)} ({time.monotonic() - started:.0f}s)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
