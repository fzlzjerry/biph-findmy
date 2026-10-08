"""Photos are served from our own domain so they load in mainland China (CDN-cached for a year)."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..services.storage import get_storage

router = APIRouter(tags=["media"])
KEY_RE = re.compile(r"^items/[0-9a-f-]{36}/[0-9a-f]{32}(_t)?\.jpg$")


@router.get("/media/{key:path}")
def media(key: str) -> Response:
    if not KEY_RE.match(key):
        raise HTTPException(404, "not_found")
    data = get_storage().get(key)
    if data is None:
        raise HTTPException(404, "not_found")
    return Response(data, media_type="image/jpeg",
                    headers={"Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable"})
