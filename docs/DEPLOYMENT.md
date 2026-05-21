# Deployment

End-to-end guide for deploying FluxBill on free tiers, using **Netlify** for the frontend and **ngrok** to tunnel the locally-running backend. Total time: ~15 minutes once accounts exist.

## Accounts you need

| Service | Purpose | Free tier |
|---|---|---|
| [GitHub](https://github.com) | Source of truth for the frontend | Free |
| [Neon](https://neon.tech) | Postgres database | 0.5 GB, never sleeps |
| [OpenRouter](https://openrouter.ai) | LLM API for the assistant | Free models, key required |
| [ngrok](https://ngrok.com) | Public tunnel to the local backend | 1 reserved static domain |
| [Netlify](https://www.netlify.com) | Frontend host | Starter plan |

No credit card required for any of the above.

> **Topology note.** This setup hosts the backend *on your local machine* and exposes it through an ngrok tunnel. The Netlify frontend stays up 24/7, but the assistant/CRUD endpoints only work while your backend + ngrok processes are running. That's the trade-off for not paying for a backend host.

---

## 1. Provision the database (Neon)

1. Sign in at https://console.neon.tech.
2. Create a new project — pick a region close to where you'll be running the backend.
3. Copy the **pooled** connection string. It looks like:
   ```
   postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
   ```
4. Save it as `DATABASE_URL` in `backend/.env`. [backend/db.py](../backend/db.py) automatically upgrades the driver to `postgresql+psycopg://` and keeps the rest of the URL intact.

## 2. Get an OpenRouter API key

1. Sign in at https://openrouter.ai and visit *Keys*.
2. Create a key. Free models like `meta-llama/llama-3.1-8b-instruct:free` work without billing.
3. Save it as `OPENROUTER_API_KEY` in `backend/.env`.

## 3. Reserve an ngrok static domain

Free ngrok URLs rotate on every restart. A reserved static domain keeps `VITE_BACKEND_URL` stable so you don't have to rebuild Netlify each time.

1. Sign in at https://dashboard.ngrok.com.
2. *Cloud Edge → Domains → Create Domain*. You get one free static domain like `fluxbill-demo.ngrok-free.app`.
3. Install the CLI: `winget install ngrok.ngrok` (Windows) or follow https://ngrok.com/download.
4. Authenticate once: `ngrok config add-authtoken <token from dashboard>`.

## 4. Run the backend + tunnel

In **two terminals on your local machine**:

```bash
# terminal 1 — backend (Postgres comes up alongside via docker compose)
docker compose up backend db
```

```bash
# terminal 2 — public tunnel pointing at the local backend
ngrok http --domain=<your-reserved>.ngrok-free.app 8000
```

Smoke test from any browser:

- `https://<your-reserved>.ngrok-free.app/healthz` → `{"status":"ok"}`
- `https://<your-reserved>.ngrok-free.app/api/initial-state` → JSON with seeded customers and subscriptions

If you'd rather hit Neon directly instead of the local Postgres, set `DATABASE_URL` in `backend/.env` to the Neon URL and run `docker compose up backend` (no `db`).

## 5. Deploy the frontend to Netlify

1. https://app.netlify.com/start — connect your GitHub account and pick the `fluxbill` repo.
2. **Base directory**: `frontend` (also set in [netlify.toml](../frontend/netlify.toml)).
3. **Build command**: `npm run build`.
4. **Publish directory**: `frontend/dist`.
5. **Environment variables** (Site settings → Build & deploy → Environment):
   - `VITE_BACKEND_URL=https://<your-reserved>.ngrok-free.app`
6. *Deploy site*. You'll get `https://<random>.netlify.app` — rename it under *Site settings → Site information → Change site name* to something like `fluxbill`.

The SPA `/*` → `/index.html` rewrite is already declared in `netlify.toml`, so deep links work.

## 6. Close the CORS loop

The backend's default `CORS_ORIGIN_REGEX` already accepts any `*.netlify.app` subdomain (covers production + deploy-previews + branch deploys) and any `*.ngrok-free.app` / `*.ngrok.app` host, so no change is normally needed.

If you used a custom domain or want a stricter allow-list, set `CORS_ORIGINS` in `backend/.env` explicitly:

```
CORS_ORIGINS=https://fluxbill.netlify.app,https://<your-custom-domain>
```

Restart the backend (`docker compose restart backend`) after editing.

## 7. End-to-end test

1. Open the Netlify URL.
2. Dashboard should load with seeded customers/invoices/subscriptions (these come over the ngrok tunnel from your local Postgres or Neon).
3. Click the assistant widget → type `open invoices` → tab should switch.
4. Click the mic → say `open customers` → tab should switch.
5. Type `create invoice for apex 25000 INR` → the assistant should call the create endpoint and the row should appear.

If any step fails, check:
- The ngrok terminal window — it logs every request, including CORS preflights.
- The browser DevTools console — CORS errors point at a missing origin in `CORS_ORIGIN_REGEX`.
- The backend logs (`docker compose logs -f backend`).

---

## Custom domain (optional, free)

If you want a friendlier URL than `fluxbill.netlify.app`:

- **Free options**: a `*.tech` student domain, [is-a.dev](https://is-a.dev) (free developer subdomain via PR), or any TLD you already own.
- Add it as a custom domain in Netlify; Netlify issues a Let's Encrypt cert automatically.
- The backend (ngrok) URL stays as-is — only the frontend domain changes.

## Tearing it down

- Netlify site → *Site settings → General → Delete this site*.
- ngrok reserved domain → *Cloud Edge → Domains → Delete*.
- Neon project → *Settings → Delete project*.
- OpenRouter key → revoke from *Keys*.
- Backend on local machine → `docker compose down -v`.
