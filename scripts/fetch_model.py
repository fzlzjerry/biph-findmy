"""Download the multilingual sentence-embedding model used by the matcher.

    python scripts/fetch_model.py            # downloads into matcher/models/<model>/
    HF_ENDPOINT=https://hf-mirror.com python scripts/fetch_model.py   # from mainland China

The files are pinned to one Hugging Face revision and checked against SHA-256 hashes, so a
deployment always runs exactly the model that the evaluation report measured.
"""

from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

import httpx

REPO = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
REVISION = "e8f8c211226b894fcb81acc59f3b34ba3efd5f42"
FILES = {
    # remote path -> (local name, sha256)
    "onnx/model_quint8_avx2.onnx": ("model.onnx", "98a01d88b7de996cdea58c32ca71208c09968d143798814b2ea09d3439dc334f"),
    "tokenizer.json": ("tokenizer.json", "2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8"),
}
TARGET = Path(__file__).resolve().parents[1] / "matcher" / "models" / "paraphrase-multilingual-MiniLM-L12-v2"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    endpoint = os.environ.get("HF_ENDPOINT", "https://huggingface.co").rstrip("/")
    TARGET.mkdir(parents=True, exist_ok=True)
    for remote, (local, expected) in FILES.items():
        dest = TARGET / local
        if dest.exists() and (expected.startswith("SHA_") or sha256(dest) == expected):
            print(f"✓ {local} already present")
            continue
        url = f"{endpoint}/{REPO}/resolve/{REVISION}/{remote}"
        print(f"↓ {url}")
        tmp = dest.with_suffix(dest.suffix + ".part")
        with httpx.stream("GET", url, follow_redirects=True, timeout=120) as resp:
            resp.raise_for_status()
            with tmp.open("wb") as fh:
                for chunk in resp.iter_bytes(1 << 20):
                    fh.write(chunk)
        actual = sha256(tmp)
        if not expected.startswith("SHA_") and actual != expected:
            tmp.unlink()
            print(f"✗ checksum mismatch for {local}: {actual}", file=sys.stderr)
            return 1
        tmp.rename(dest)
        print(f"✓ {local} ({dest.stat().st_size / 1e6:.1f} MB, sha256 {actual[:12]}…)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
