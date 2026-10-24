# Nurse Worry Layer — Charge Console
#
# `make` with no target prints this help.
# The API must be running on :5001 first — `make -C ../nursing-backend start`.

SHELL := /bin/bash
.DEFAULT_GOAL := help
# Keep stdout clean so targets can be piped (make me | jq).
MAKEFLAGS += --no-print-directory

PORT    := 5174
LOGDIR  := /tmp/nursing-logs

.PHONY: help install dev start stop status build preview typecheck lint check logs clean

help: ## Show this help
	@echo "Nurse Worry Layer — Charge Console (port $(PORT))"
	@echo
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo

install: ## Install dependencies and create .env.local
	@npm install
	@test -f .env.local || { cp .env.example .env.local; echo "Created .env.local — fill in VITE_SUPABASE_ANON_KEY."; }

dev: ## Run the dev server in the foreground (Ctrl-C to stop)
	@$(MAKE) --no-print-directory check-api
	@npm run dev

start: ## Run the dev server in the background
	@mkdir -p $(LOGDIR)
	@if ss -lptn 'sport = :$(PORT)' 2>/dev/null | grep -q pid=; then \
		echo "Already running on :$(PORT)."; \
	else \
		nohup npm run dev > $(LOGDIR)/dashboard.log 2>&1 & \
		sleep 4; \
		$(MAKE) --no-print-directory status; \
	fi

stop: ## Stop the background dev server
	@pids=$$(ss -lptn 'sport = :$(PORT)' 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u); \
	if [ -n "$$pids" ]; then kill $$pids 2>/dev/null; sleep 1; \
		pids=$$(ss -lptn 'sport = :$(PORT)' 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u); \
		[ -n "$$pids" ] && kill -9 $$pids 2>/dev/null; \
		echo "Stopped."; \
	else echo "Not running."; fi

status: ## Show whether the dev server is listening
	@pid=$$(ss -lptn 'sport = :$(PORT)' 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1); \
	if [ -n "$$pid" ]; then echo "Charge Console running on http://localhost:$(PORT) (pid $$pid)"; \
	else echo "Charge Console not running"; fi

check-api: ## Warn if the API is not up (dev depends on this)
	@curl -fsS -o /dev/null localhost:5001/api/v1/health 2>/dev/null \
		|| echo "WARNING: API not responding on :5001 — run 'make -C ../nursing-backend start' or every screen will error."

build: ## Production build
	@npm run build

preview: ## Serve the production build
	@npm run preview

typecheck: ## tsc --build, no emit
	@npx tsc -b

lint: ## oxlint
	@npm run lint

check: typecheck lint build ## Typecheck, lint and build

logs: ## Tail the background dev-server log
	@tail -f $(LOGDIR)/dashboard.log

clean: ## Remove build output and caches
	@rm -rf dist dev-dist node_modules/.vite
	@echo "Cleaned."
