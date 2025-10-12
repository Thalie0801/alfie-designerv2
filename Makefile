.PHONY: codex migrate cleanup test validate

codex:
	bash scripts/codex/run.sh

migrate:
	psql "$$DATABASE_URL" -f db/migrations/20251012_refonte.sql

cleanup:
	RETENTION_DAYS=30 bash scripts/storage_cleanup.sh

test:
	npm test --scripts-prepend-node-path

validate:
	bash scripts/validate_refonte.sh
