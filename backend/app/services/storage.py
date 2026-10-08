"""Photo storage: local disk in development, Vercel Blob in production.

Photos are always served through our own domain (/media/<key>) so students in mainland China
never need to reach a third-party storage domain.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from ..config import get_settings


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise ValueError("invalid key")
        return path

    def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> bytes | None:
        try:
            path = self._path(key)
        except ValueError:
            return None
        return path.read_bytes() if path.is_file() else None


class BlobStorage:
    def __init__(self, token: str):
        self.token = token

    def put(self, key: str, data: bytes, content_type: str) -> None:
        from vercel import blob

        blob.put(key, data, access="public", content_type=content_type, add_random_suffix=False,
                 overwrite=True, cache_control_max_age=31536000, token=self.token)

    def get(self, key: str) -> bytes | None:
        from vercel import blob

        try:
            return blob.get(key, access="public", token=self.token).content
        except blob.BlobNotFoundError:
            return None


@lru_cache
def get_storage() -> LocalStorage | BlobStorage:
    s = get_settings()
    if s.storage_backend == "blob":
        if not s.blob_read_write_token:
            raise RuntimeError("STORAGE_BACKEND=blob but BLOB_READ_WRITE_TOKEN is not set")
        return BlobStorage(s.blob_read_write_token)
    return LocalStorage(s.local_storage_dir)
