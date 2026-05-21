# FluxBill Frontend

Vite + React 19 dashboard. Single-page app that talks to the FluxBill backend via REST and the `/assistant/*` endpoints for text/voice intent.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies nothing — `VITE_BACKEND_URL` must point at a running backend.

## Build

```bash
npm run build
npm run preview
```

Output in `dist/`.

## Deploy

Netlify picks up [netlify.toml](netlify.toml), which sets `base = "frontend"`, `command = "npm run build"`, `publish = "dist"`, and a SPA fallback to `/index.html`. Configure `VITE_BACKEND_URL` (your ngrok URL) as a build-time env var in *Site settings → Build & deploy → Environment* — Vite inlines it into the bundle, so you must redeploy after changing it.
