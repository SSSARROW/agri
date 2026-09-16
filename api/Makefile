.PHONY: dev migrate seed

dev:
	.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

migrate:
	.venv/bin/python -m alembic upgrade head

seed:
	.venv/bin/python -m app.seed
