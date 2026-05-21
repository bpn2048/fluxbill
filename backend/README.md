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

Requires a reachable Postgres at `DATABASE_URL`. The simplest path is `docker compose up` from the repo root, which starts Postgres, the backend, and the frontend in one command.

## Expose to the internet with ngrok

The Netlify-deployed frontend needs a public URL for this backend. We use [ngrok](https://ngrok.com) to tunnel the locally-running backend.

```bash
# terminal 1 — backend listening on :8000
docker compose up backend db

# terminal 2 — open a public tunnel
ngrok http 8000
```

Copy the `https://<id>.ngrok-free.app` URL ngrok prints and set it as `VITE_BACKEND_URL` on Netlify (then trigger a redeploy so Vite inlines it into the bundle). The default `CORS_ORIGIN_REGEX` already accepts `*.ngrok-free.app` and `*.ngrok.app`, so no extra backend config is needed.

Tip: free ngrok URLs change every restart. Reserve a static domain on the ngrok dashboard and run `ngrok http --domain=<your-reserved>.ngrok-free.app 8000` to keep `VITE_BACKEND_URL` stable.

## Configuration

See [.env.example](.env.example). Key vars: `DATABASE_URL`, `OPENROUTER_API_KEY`, `CORS_ORIGINS`, `CORS_ORIGIN_REGEX`, `WHISPER_MODEL`.
