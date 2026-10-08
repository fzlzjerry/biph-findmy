# Self-hosted fallback for BIPH FindMy (e.g. a Hong Kong VPS or a school server) in case the Vercel
# deployment is unreachable from campus. Same app, same matcher; SQLite + local disk by default.
#
#   docker compose up -d --build                       # see docs/self-hosting.md
#
# Building from mainland China? Pass mirrors:
#   docker compose build --build-arg HF_ENDPOINT=https://hf-mirror.com \
#     --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
#     --build-arg PYPI_INDEX=https://mirrors.aliyun.com/pypi/simple

FROM node:24-slim AS web
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund --registry="$NPM_REGISTRY"
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.10.11 /uv /usr/local/bin/uv
ARG PYPI_INDEX=https://pypi.org/simple
ARG HF_ENDPOINT=https://huggingface.co
ENV UV_DEFAULT_INDEX="$PYPI_INDEX" UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app

COPY pyproject.toml uv.lock .python-version README.md ./
RUN uv sync --frozen --no-dev --group server --no-install-project

COPY scripts/fetch_model.py scripts/
RUN HF_ENDPOINT="$HF_ENDPOINT" .venv/bin/python scripts/fetch_model.py
COPY matcher/ matcher/
COPY backend/ backend/
COPY --from=web /src/frontend/dist frontend/dist

RUN useradd --create-home --uid 1000 findmy && mkdir -p /data && chown findmy /data
USER findmy
ENV APP_ENV=production \
    DATABASE_URL=sqlite:////data/findmy.sqlite3 \
    STORAGE_BACKEND=local \
    LOCAL_STORAGE_DIR=/data/uploads
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD .venv/bin/python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
CMD [".venv/bin/uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
