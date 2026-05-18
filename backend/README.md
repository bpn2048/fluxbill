---
title: FluxBill Backend
emoji: 💸
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# FluxBill Backend

FastAPI service powering the FluxBill dashboard. Provides REST CRUD for invoices, customers, subscriptions, and an LLM-powered command planner that turns natural-language text or voice into UI actions.

## Endpoints

| Path | Description |
|---|---|
| `GET /healthz` | Health probe |
| `GET /api/initial-state` | Bootstrap payload for the SPA |
| `GET /api/invoices` | List invoices (with filters) |
| `POST /api/invoices` | Create invoice |
| `PATCH /api/invoices/{id}` | Update invoice |
| `DELETE /api/invoices/{id}` | Delete invoice |
| `* /api/customers...` | Customer CRUD |
| `* /api/subscriptions...` | Subscription CRUD |
| `PATCH /api/settings` | Update app settings |
| `GET /api/search` | Unified entity search |
| `POST /assistant/text` | Plan a command from text |
| `POST /assistant/voice` | Transcribe + plan from audio |

## Run locally

```bash
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Requires a reachable Postgres at `DATABASE_URL`. Run with docker-compose from the repo root for a one-command setup.

## Configuration

See [.env.example](.env.example). Key vars: `DATABASE_URL`, `OPENROUTER_API_KEY`, `CORS_ORIGINS`, `WHISPER_MODEL`.
