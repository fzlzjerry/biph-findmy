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
    """Vercel Blob over its HTTP API (same protocol as the official SDK, without its ~40 MB of
    dependencies — every MB here is paid again on each cold start)."""

    API_URL = "https://vercel.com/api/blob"
    API_VERSION = "11"

    def __init__(self, token: str):
        import httpx

        self.token = token
        # Token format: vercel_blob_rw_<storeId>_<secret>
        store_id = token.split("_")[3] if token.count("_") >= 4 else ""
        if not store_id:
            raise RuntimeError("BLOB_READ_WRITE_TOKEN has an unexpected format")
        self.public_base = f"https://{store_id.lower()}.public.blob.vercel-storage.com"
        self.http = httpx.Client(timeout=30)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        resp = self.http.put(self.API_URL, params={"pathname": key}, content=data, headers={
            "authorization": f"Bearer {self.token}",
            "x-api-version": self.API_VERSION,
            "x-vercel-blob-access": "public",
            "x-content-type": content_type,
            "x-add-random-suffix": "0",
            "x-allow-overwrite": "1",
            "x-cache-control-max-age": "31536000",
        })
        resp.raise_for_status()

    def get(self, key: str) -> bytes | None:
        resp = self.http.get(f"{self.public_base}/{key}", follow_redirects=True)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.content


@lru_cache
def get_storage() -> LocalStorage | BlobStorage:
    s = get_settings()
    if s.storage_backend == "blob":
        if not s.blob_read_write_token:
            raise RuntimeError("STORAGE_BACKEND=blob but BLOB_READ_WRITE_TOKEN is not set")
        return BlobStorage(s.blob_read_write_token)
    return LocalStorage(s.local_storage_dir)
