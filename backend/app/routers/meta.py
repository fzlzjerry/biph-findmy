from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from matcher import get_matcher

from ..config import get_settings
from ..db import get_db
from ..dropoffs import get_dropoffs

router = APIRouter(tags=["meta"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # pragma: no cover - surfaced in the JSON
        db_ok = False
    m = get_matcher()  # also warms the model after a cold start
    return {"ok": db_ok, "db": db_ok, "matcher": m.model_version, "model_loaded": m.embedder is not None}


@router.get("/meta")
def meta() -> dict:
    s = get_settings()
    m = get_matcher()
    v = m.vocab
    categories = {}
    for cid, cat in v.categories.items():
        parent = categories.setdefault(cat.parent, {"id": cat.parent, "label": v.parents[cat.parent], "children": []})
        parent["children"].append({"id": cid, "label": cat.label, "sensitive": cat.sensitive})
    zones = {}
    for pid, place in v.places.items():
        zone = zones.setdefault(place.zone, {"id": place.zone, "label": v.zones[place.zone], "places": []})
        zone["places"].append({"id": pid, "label": place.label})
    return {
        "categories": list(categories.values()),
        "colors": [{"id": cid, "label": c["label"], "hex": c["hex"]} for cid, c in v.colors.items()],
        "brands": [{"id": bid, "label": label} for bid, label in sorted(v.brands.items(), key=lambda kv: kv[1])],
        "zones": list(zones.values()),
        "auth": {"backend": s.auth_backend, "domains": sorted(s.domains),
                 "dev_show_code": s.dev_show_code and s.auth_backend == "local" and not s.is_production},
        "bands": m.weights.thresholds,
        "matcher": {"version": m.model_version, "embeddings": m.embedder is not None},
        "item_ttl_days": s.item_ttl_days,
        "dropoffs": [{"id": p.id, "kind": p.kind, "label": p.label, "ttl_days": p.ttl_days}
                     for p in get_dropoffs().points.values()],
        "value_classes": {"high": sorted(get_dropoffs().high), "low": sorted(get_dropoffs().low)},
    }


class AnalyzeRequest(BaseModel):
    text: str = Field(default="", max_length=2000)
    marks_text: str = Field(default="", max_length=500)


@router.post("/analyze")
def analyze(body: AnalyzeRequest) -> dict:
    return get_matcher().analyze(body.text, body.marks_text)
