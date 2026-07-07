.PHONY: ui test build lint e2e

# Open the pipeline health dashboard (serves ui/ and launches the browser)
ui:
	@chmod +x scripts/open-ui.sh
	@./scripts/open-ui.sh

test:
	pnpm exec nx run-many -t test

build:
	pnpm exec nx run-many -t build

lint:
	pnpm exec nx run-many -t lint

e2e:
	pnpm exec nx run web:e2e
