BACKEND_ENV := backend/backend/.env
COMPOSE := docker compose --env-file $(BACKEND_ENV)

.DEFAULT_GOAL := help
.PHONY: help setup deps env-check db migrate seed dev backend frontend test check lint down reset-db

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-10s %s\n", $$1, $$2}'

setup: $(BACKEND_ENV) env-check deps ## Create the backend .env and install both apps' dependencies

$(BACKEND_ENV):
	cp backend/backend/.env.example $@
	sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=$$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')|" $@ && rm -f $@.bak
	@echo "Created $@ with a fresh SECRET_KEY"

deps:
	cd backend && uv sync
	cd frontend && pnpm install --frozen-lockfile

env-check:
	@if grep -qE '^(POSTGRES_PORT=5432|POSTGRES_DB=kbackend_db|POSTGRES_HOST=localhost)' $(BACKEND_ENV) 2>/dev/null; then \
		echo ""; \
		echo "WARNING: $(BACKEND_ENV) looks like it predates the current template"; \
		echo "(port 5432, database kbackend_db or host 'localhost'). If migrations fail with"; \
		echo "'password authentication failed', see Troubleshooting in the README."; \
		echo ""; \
	fi

db: env-check ## Start PostgreSQL and Mailpit (dev inbox, :8025) in Docker and wait until ready
	$(COMPOSE) up -d --wait db mailpit

migrate: ## Apply database migrations
	cd backend && uv run python backend/manage.py migrate

seed: ## Create the demo user (demo@example.com), development only
	cd backend && uv run python backend/manage.py seed_demo

dev: db migrate seed ## Run everything: database, API on :8000, web app on :3000
	$(MAKE) -j2 backend frontend

backend: ## Run only the Django API on :8000
	cd backend && uv run python backend/manage.py runserver

frontend: ## Run only the Next.js app on :3000
	cd frontend && pnpm dev

test: db ## Run the backend tests
	cd backend && uv run pytest backend --ds=config.settings -q

lint: ## Lint and type-check both apps
	cd backend && uv run ruff check backend --no-fix && uv run ruff format backend --check && uv run mypy backend
	cd frontend && pnpm lint && pnpm exec prettier --check . && pnpm type-check

check: lint test ## Everything CI runs, plus the backend tests

down: ## Stop the Docker services (database data is kept)
	$(COMPOSE) down

reset-db: ## Delete the database volume and start a fresh database
	$(COMPOSE) down -v
	$(MAKE) db
