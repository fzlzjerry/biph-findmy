"""Validate and normalise uploaded photos: decode by content, fix rotation, strip EXIF (GPS!)."""

from __future__ import annotations

import io

from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:  # pragma: no cover
    pass

Image.MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "HEIF", "HEIC", "MPO", "GIF", "AVIF"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
FULL_SIZE = 1600
THUMB_SIZE = 480


class ImageError(ValueError):
    pass


def _encode(img: Image.Image, size: int, quality: int) -> bytes:
    copy = img.copy()
    copy.thumbnail((size, size), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    copy.save(out, "JPEG", quality=quality, optimize=True, progressive=True)  # no EXIF written
    return out.getvalue()


def process(data: bytes) -> tuple[bytes, bytes, int, int]:
    """Returns (full_jpeg, thumb_jpeg, width, height). Raises ImageError for bad input."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise ImageError("too_large")
    try:
        img = Image.open(io.BytesIO(data))
        fmt = (img.format or "").upper()
        if fmt not in ALLOWED_FORMATS:
            raise ImageError("unsupported_format")
        img.load()
    except (Image.DecompressionBombError, OSError, SyntaxError) as exc:
        raise ImageError("unreadable") from exc
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        rgba = img.convert("RGBA")
        background.paste(rgba, mask=rgba.split()[-1])
        img = background
    img = img.convert("RGB")
    full = _encode(img, FULL_SIZE, 82)
    thumb = _encode(img, THUMB_SIZE, 75)
    w, h = img.size
    scale = min(1.0, FULL_SIZE / max(w, h))
    return full, thumb, round(w * scale), round(h * scale)
