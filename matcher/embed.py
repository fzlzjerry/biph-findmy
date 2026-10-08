"""Multilingual sentence embeddings with ONNX Runtime (no PyTorch).

Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2, int8-quantised (118 MB).
It was trained so that a sentence and its translation land close together, which is exactly
what we need for "黑色保温杯" vs "black thermos". Output: 384-dim, L2-normalised vectors.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
DEFAULT_DIR = Path(__file__).resolve().parent / "models" / MODEL_NAME
DIM = 384


class OnnxEmbedder:
    name = "onnx-minilm-l12-q8"

    def __init__(self, model_dir: Path, threads: int | None = None):
        import onnxruntime as ort
        from tokenizers import Tokenizer

        self.tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=128)
        self.tokenizer.enable_padding(pad_id=self.tokenizer.token_to_id("<pad>") or 1, pad_token="<pad>")
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads or int(os.environ.get("MATCHER_THREADS", "2"))
        opts.inter_op_num_threads = 1
        opts.log_severity_level = 3
        self.session = ort.InferenceSession(
            str(model_dir / "model.onnx"), sess_options=opts, providers=["CPUExecutionProvider"]
        )
        self.inputs = {i.name for i in self.session.get_inputs()}
        self._cache: dict[str, np.ndarray] = {}

    def encode(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        """Embed texts; identical strings are served from a small in-process cache."""
        out = np.zeros((len(texts), DIM), dtype=np.float32)
        todo = [i for i, t in enumerate(texts) if t not in self._cache]
        for start in range(0, len(todo), batch_size):
            idx = todo[start : start + batch_size]
            batch = [texts[i] or " " for i in idx]
            enc = self.tokenizer.encode_batch(batch)
            ids = np.array([e.ids for e in enc], dtype=np.int64)
            mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
            feeds = {"input_ids": ids, "attention_mask": mask}
            if "token_type_ids" in self.inputs:
                feeds["token_type_ids"] = np.zeros_like(ids)
            hidden = self.session.run(None, feeds)[0]
            summed = (hidden * mask[..., None]).sum(axis=1)
            pooled = summed / np.clip(mask.sum(axis=1, keepdims=True), 1, None)
            pooled /= np.clip(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12, None)
            for row, i in enumerate(idx):
                vec = pooled[row].astype(np.float32)
                if len(self._cache) < 4096:
                    self._cache[texts[i]] = vec
                out[i] = vec
        for i, t in enumerate(texts):
            if i not in todo:
                out[i] = self._cache[t]
        return out

    def encode_one(self, text: str) -> np.ndarray:
        return self.encode([text])[0]


@lru_cache(maxsize=1)
def load_embedder(model_dir: str | None = None) -> OnnxEmbedder | None:
    """Return the embedder, or None (→ TF-IDF fallback) if the model files are missing."""
    path = Path(model_dir or os.environ.get("MATCHER_MODEL_DIR") or DEFAULT_DIR)
    if not (path / "model.onnx").exists() or not (path / "tokenizer.json").exists():
        log.warning("embedding model not found in %s — using TF-IDF only", path)
        return None
    try:
        return OnnxEmbedder(path)
    except Exception:  # pragma: no cover - corrupted model / missing runtime
        log.exception("failed to load embedding model — using TF-IDF only")
        return None


def to_bytes(vec: np.ndarray | None) -> bytes | None:
    return None if vec is None else np.asarray(vec, dtype=np.float32).tobytes()


def from_bytes(blob: bytes | None) -> np.ndarray | None:
    if not blob:
        return None
    vec = np.frombuffer(blob, dtype=np.float32)
    return vec if vec.shape[0] == DIM else None
