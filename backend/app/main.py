"""FastAPI entrypoint (Vercel: tool.vercel.entrypoint = "backend.app.main:app")."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI

from .auth import csrf_guard
from .config import get_settings
from .db import init_db
from .routers import admin, auth, cron, items, media, meta, staff

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.database_url.startswith("sqlite"):
        init_db()  # local dev / tests; production schema comes from supabase/migrations
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="BIPH FindMy API", version="1.0.0", lifespan=lifespan,
                  docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    api = APIRouter(prefix="/api", dependencies=[Depends(csrf_guard)])
    for module in (meta, auth, items, admin, staff, cron):
        api.include_router(module.router)
    app.include_router(api)
    app.include_router(media.router)
    if FRONTEND_DIST.is_dir() or os.environ.get("VERCEL"):
        app.frontend("/", directory=str(FRONTEND_DIST), fallback="index.html", check_dir=False)
    return app


app = create_app()
