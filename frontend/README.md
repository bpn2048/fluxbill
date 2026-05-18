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

Vercel auto-detects this folder when set as the project root. Configure `VITE_BACKEND_URL` as a build-time env var — it gets inlined into the bundle.
