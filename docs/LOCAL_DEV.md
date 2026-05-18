# Local development

One command: `docker compose up`. Everything else here is detail.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- An OpenRouter API key if you want the AI assistant to do anything beyond hardcoded navigation (text intents like *"open invoices"* work without a key)

## First-time setup

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Open `backend/.env` and set:

```
OPENROUTER_API_KEY=<your key>
```

Everything else has sensible defaults.

## Run

```bash
docker compose up --build
```

What this brings up:

| Service | Port | URL |
|---|---|---|
| `db` (postgres:16) | 5432 | — |
| `backend` (FastAPI) | 8000 | http://localhost:8000 |
| `frontend` (Vite dev server) | 5173 | http://localhost:5173 |

The backend waits for Postgres to be healthy before starting. On first boot it creates tables and seeds dummy data.

## Verify

- http://localhost:8000/healthz → `{"status":"ok"}`
- http://localhost:8000/api/initial-state → JSON with seeded customers + subscriptions
- http://localhost:5173 → dashboard renders with data
- Open the assistant widget, type `open invoices` — tab should switch
- Click the mic, say `open customers` — tab should switch

## Hot reload

- **Frontend**: `src/`, `public/`, `index.html` are bind-mounted, so HMR works as usual.
- **Backend**: not bind-mounted by default. Either restart the container after changes (`docker compose restart backend`) or run uvicorn outside Docker:
  ```bash
  cd backend
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
  ```
  In that case, keep `db` running via `docker compose up db`.

## Resetting state

```bash
docker compose down -v
```

Wipes the Postgres volume. Next `up` re-seeds.

## Common issues

- **`OPENROUTER_API_KEY is not set`** on assistant calls — set the key in `backend/.env` and restart.
- **CORS error in the browser** — the dev origin `http://localhost:5173` is whitelisted by default. If you change the port, update `CORS_ORIGINS` in `backend/.env`.
- **Whisper first transcription is slow** — the `tiny` model is pre-baked into the image, so this should not happen. If it does, check the image actually got rebuilt: `docker compose build backend`.
- **`postgres://...` URL rejected** — `db.py` rewrites the scheme. If you see a driver error, your URL is missing required SQLAlchemy bits; refer to [docs/DEPLOYMENT.md](DEPLOYMENT.md#1-provision-the-database-neon).
