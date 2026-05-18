# FluxBill

AI-assisted billing dashboard demo. React + Vite frontend, FastAPI backend with an LLM-powered voice and text assistant that drives the UI.

| | |
|---|---|
| Frontend | Vite + React 19, deployed on Vercel |
| Backend | FastAPI + LangChain + `faster-whisper`, containerized for Hugging Face Spaces |
| Database | Postgres (Neon serverless for prod, local docker image for dev) |
| LLM | OpenRouter (`meta-llama/llama-3.1-8b-instruct:free` by default) |
| Voice STT | `faster-whisper`, default `tiny` model, runs CPU-only |

## Live demo

- Frontend: _TBD — set after first Vercel deploy_
- Backend: _TBD — set after first Hugging Face Spaces deploy_

## Layout

```
fluxbill/
├── backend/     FastAPI service, AI command planner, Whisper STT
│   ├── main.py
│   ├── billing_route.py
│   ├── db.py
│   ├── models.py
│   ├── seed.py
│   ├── Dockerfile
│   └── README.md          # also serves as the HF Spaces README
├── frontend/    Vite + React 19 dashboard
│   ├── src/
│   ├── package.json
│   └── vercel.json
├── docs/
│   ├── ARCHITECTURE.md    # components and data flow
│   ├── DEPLOYMENT.md      # step-by-step deploy to Vercel + HF + Neon
│   └── LOCAL_DEV.md       # docker compose up walkthrough
└── docker-compose.yml     # one-command local stack
```

## Quickstart

```bash
cp backend/.env.example backend/.env       # add OPENROUTER_API_KEY
cp frontend/.env.example frontend/.env.local
docker compose up --build
```

- Frontend at http://localhost:5173
- Backend at http://localhost:8000 (`/healthz`, `/api/initial-state`, `/assistant/text`, `/assistant/voice`)
- Dummy data is auto-seeded on first boot.

Full walkthrough: [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md).

## Deploy

```
Frontend  →  Vercel       (free, native Vite support)
Backend   →  HF Spaces    (free, Docker SDK, no credit card)
Database  →  Neon         (free, never-sleep Postgres)
LLM       →  OpenRouter   (free models available)
```

Step-by-step: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Architecture

The frontend dispatches user input (text or audio) to the backend. The backend transcribes audio with `faster-whisper`, then plans a structured `Command` via LangChain + OpenRouter, then returns it to the SPA, which executes it against its own `AssistantRegistry` (click, type, or CRUD).

Detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

This is a demo. Treat as MIT-equivalent unless replaced with an explicit license file.
