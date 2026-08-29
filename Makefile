.DEFAULT_GOAL := help
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

PLUGIN_ID := vault-full-statistics
ARTIFACTS := main.js styles.css manifest.json
VERSION = $(shell node -p 'require("./package.json").version')
VAULT_PATH = $(patsubst ~/%,$(HOME)/%,$(VAULT))

.PHONY: help install ci-install dev build typecheck test test-watch coverage \
        lint lint-fix check clean deploy version tag

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install all Node dependencies
	npm install

ci-install: ## Install dependencies from the lockfile, as CI does
	npm ci

dev: ## Start the development server
	npm run dev

build: ## Build the project
	npm run build

typecheck: ## Type-check the sources without emitting anything
	npx tsc -noEmit -skipLibCheck

test: ## Run all tests in project
	npm test

test-watch: ## Run tests in watch mode
	npm test -- --watch

coverage: ## Run tests and write a coverage report
	npm test -- --coverage

lint: ## Run oxlint over the TypeScript sources
	npm run lint

lint-fix: ## Run oxlint and apply the fixes it can make
	npm run lint -- --fix

check: ## Run the full CI pipeline locally (deps, lint, test, build)
	$(MAKE) ci-install
	$(MAKE) lint
	$(MAKE) test
	$(MAKE) build

clean: ## Remove build artifacts and the coverage report
	rm -rf main.js *.map coverage

deploy: build ## Copy the built plugin into a vault (make deploy VAULT=/path/to/vault)
	@test -n "$(VAULT)" || { echo "VAULT is not set: make deploy VAULT=/path/to/vault"; exit 1; }
	@test -d "$(VAULT_PATH)/.obsidian" || { echo "$(VAULT_PATH) is not an Obsidian vault: no .obsidian directory"; exit 1; }
	mkdir -p "$(VAULT_PATH)/.obsidian/plugins/$(PLUGIN_ID)"
	cp $(ARTIFACTS) "$(VAULT_PATH)/.obsidian/plugins/$(PLUGIN_ID)/"
	@echo "Deployed $(VERSION) — toggle the plugin off and on in Obsidian to reload it"

version: ## Bump current version
	npm run version

tag: ## Tag the current version for release (pushing it is up to you)
	@! git rev-parse -q --verify "refs/tags/$(VERSION)" >/dev/null \
		|| { echo "tag $(VERSION) already exists — run make version first"; exit 1; }
	@test "$$(node -p 'require("./manifest.json").version')" = "$(VERSION)" \
		|| { echo "manifest.json and package.json disagree on the version — run make version first"; exit 1; }
	git tag -a "$(VERSION)" -m "$(VERSION)"
	@echo "Tagged $(VERSION). Push it with: git push origin $(VERSION)"
