.PHONY: setup model test eval fit dev web build e2e schema notebooks docker

setup:            ## install Python + frontend deps
	uv sync
	cd frontend && npm ci

model:            ## download the multilingual embedding model (118 MB)
	uv run python scripts/fetch_model.py

test:             ## run all Python tests
	uv run pytest

fit:              ## rebuild IDF + refit scoring weights on synthetic data
	uv run python -m matcher.eval.build_idf
	uv run python -m matcher.eval.fit_weights

eval:             ## full evaluation report → docs/eval_report.md
	uv run python -m matcher.eval.run

dev:              ## API on :8000 with demo data (local SQLite + local auth)
	APP_ENV=development uv run python -m backend.app.seed --reset
	APP_ENV=development uv run uvicorn backend.app.main:app --reload --port 8000

web:              ## frontend dev server on :5173 (proxies /api to :8000)
	cd frontend && npm run dev

build:            ## production frontend build
	cd frontend && npm run build

e2e:              ## Playwright end-to-end tests
	cd frontend && npm run test:e2e

schema:           ## regenerate supabase/migrations from the SQLAlchemy models
	uv run python scripts/gen_schema.py

notebooks:        ## re-run the Data Science Club notebooks (outputs are saved in place)
	uv run python scripts/run_notebooks.py

docker:           ## self-hosted fallback image (docs/self-hosting.md)
	docker compose build
