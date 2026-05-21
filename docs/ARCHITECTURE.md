# Architecture

FluxBill is a two-tier demo: a Vite/React SPA in `frontend/` and a FastAPI service in `backend/`. State lives in Postgres. The backend exposes both a conventional CRUD surface and an AI assistant that turns natural-language (text or voice) into structured UI commands.

```
┌──────────────────────┐         REST /api/*          ┌──────────────────────┐         ┌──────────────────────┐
│                      │ ───────────────────────────▶ │                      │ ──────▶ │                      │
│  Vite + React 19     │                              │  ngrok tunnel        │         │  FastAPI             │
│  (Netlify)           │ ◀───── /assistant/text  ──── │  *.ngrok-free.app    │ ◀────── │  (local Docker)      │
│                      │ ◀───── /assistant/voice ──── │                      │         │                      │
└──────────────────────┘                              └──────────────────────┘         └────────────┬─────────┘
                                                                                                    │
                                                                                                    ▼
                                                                                           ┌──────────────────┐
                                                                                           │  Postgres (Neon) │
                                                                                           └──────────────────┘
                                                                                                    ▲
                                                                                                    │
                                                                                           ┌──────────────────┐
                                                                                           │  OpenRouter LLM  │
                                                                                           └──────────────────┘
```

## Backend layout

| File | Role |
|---|---|
| [backend/main.py](../backend/main.py) | FastAPI app, CORS, assistant routes, Whisper transcription |
| [backend/billing_route.py](../backend/billing_route.py) | `/api/*` CRUD for invoices, customers, subscriptions, search, settings |
| [backend/db.py](../backend/db.py) | SQLModel engine, `DATABASE_URL` normalization (handles plain `postgresql://` from Neon by injecting `+psycopg`) |
| [backend/models.py](../backend/models.py) | `Customer`, `Invoice`, `Subscription`, `AppSetting` |
| [backend/seed.py](../backend/seed.py) | Idempotent dummy-data seeder |
| [backend/Dockerfile](../backend/Dockerfile) | python:3.11-slim + ffmpeg + prebaked Whisper |

## AI assistant flow

1. Frontend sends either a text prompt (`POST /assistant/text`) or an audio blob (`POST /assistant/voice`).
2. For voice, `faster-whisper` (default `tiny`/CPU/int8) transcribes locally; English-only, with billing-domain hotwords to bias decoding toward `invoice`, `customer`, etc.
3. The transcript is normalized for known mishearings (e.g. *"in voices"* → *"invoices"*).
4. A fast deterministic pass tries to match navigation verbs ("open invoices") without calling the LLM.
5. Otherwise, the text goes to LangChain's `RunnableWithMessageHistory` wrapping a `ChatOpenAI` client pointed at OpenRouter. Per-session chat history is kept in-process (bounded by `ASSISTANT_HISTORY_MAX_MESSAGES`).
6. The model is constrained by a system prompt + `PydanticOutputParser` to return a `Command`:
   ```json
   {"action": "create_invoice", "target": null,
    "args": {"customer_name": "Apex", "amount": 25000, "currency": "INR"},
    "reply": "drafting invoice for Apex"}
   ```
7. The frontend dispatches the `Command` into its `AssistantRegistry`, which clicks, types, or invokes CRUD on the backend.

## Data model

- `Customer (id, name, tier, status, invoices, created_at)`
- `Invoice (id, customer→Customer.id, amount, currency, status, created, due, method)`
- `Subscription (id, plan, customer→Customer.id, mrr, status, created_at)`
- `AppSetting (id=1, company_name, invoice_prefix, updated_at)` — singleton row.

IDs are application-generated with sequential suffixes (`CUST-001`, `INV-0001`, `SUB-0001`) so demo data reads well.

## Deployment topology

- **Frontend → Netlify**. SPA `/*` → `/index.html` rewrite via [frontend/netlify.toml](../frontend/netlify.toml). Build-time `VITE_BACKEND_URL` (the ngrok URL) is inlined into the bundle.
- **Backend → local Docker, exposed via ngrok**. `docker compose up backend db` runs the FastAPI container on `localhost:8000`; `ngrok http --domain=<reserved>.ngrok-free.app 8000` makes it reachable from the Netlify frontend. The reserved static domain keeps `VITE_BACKEND_URL` stable across ngrok restarts.
- **DB → Neon** (or the local `db` service for fully-offline dev). The pooled connection URL goes into `DATABASE_URL`; `db.py` upgrades it to the `+psycopg` driver SQLAlchemy needs.
- **LLM → OpenRouter**. Free model `meta-llama/llama-3.1-8b-instruct:free` is the default.

## Trade-offs worth knowing

- **Backend runs on your machine.** The Netlify frontend stays up, but `/api/*` and `/assistant/*` only work while the local backend + ngrok tunnel are both running. Acceptable for a demo; not a 24/7 prod topology.
- **ngrok adds a hop.** Every request goes browser → ngrok edge → your laptop. Expect ~50–150 ms of extra latency depending on geography, and the free plan rate-limits at a few requests/second.
- **In-memory chat history** ([main.py](../backend/main.py)) means sessions don't survive restarts and don't share across replicas. Fine for demo; for prod swap in Redis.
- **`SQLModel.metadata.create_all`** runs at startup. Good for demo seeding, bad for schema migrations — add Alembic before real data.
- **`faster-whisper` model is baked into the image.** Tradeoff: larger image, instant first request.
