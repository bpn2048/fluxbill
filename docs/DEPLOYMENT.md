# Deployment

End-to-end guide for deploying FluxBill to free tiers. Total time: ~20 minutes once accounts exist.

## Accounts you need

| Service | Purpose | Free tier |
|---|---|---|
| [GitHub](https://github.com) | Source of truth for both apps | Free |
| [Neon](https://neon.tech) | Postgres database | 0.5 GB, never sleeps |
| [OpenRouter](https://openrouter.ai) | LLM API for the assistant | Free models, key required |
| [Hugging Face](https://huggingface.co) | Backend host (Docker SDK Spaces) | 16 GB RAM, 2 vCPU |
| [Vercel](https://vercel.com) | Frontend host | Hobby plan |

No credit card required for any of the above.

---

## 1. Provision the database (Neon)

1. Sign in at https://console.neon.tech.
2. Create a new project — pick a region close to where the backend will run (Frankfurt or AWS US East are reasonable defaults for HF Spaces).
3. Copy the **pooled** connection string. It looks like:
   ```
   postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
   ```
4. Save it — you'll paste it as `DATABASE_URL` on the backend. `db.py` automatically upgrades the driver to `postgresql+psycopg://` and keeps the rest of the URL intact.

## 2. Get an OpenRouter API key

1. Sign in at https://openrouter.ai and visit *Keys*.
2. Create a key. Free models like `meta-llama/llama-3.1-8b-instruct:free` work without billing.
3. Save the key for `OPENROUTER_API_KEY`.

## 3. Deploy the backend to Hugging Face Spaces

### 3a. Create the Space

1. https://huggingface.co/new-space.
2. **Owner**: your username (e.g. `bpn2048`).
3. **Space name**: `fluxbill` (final URL: `https://<owner>-fluxbill.hf.space`).
4. **SDK**: *Docker*.
5. **Visibility**: Public.
6. Create — it gives you a git URL: `https://huggingface.co/spaces/<owner>/fluxbill`.

### 3b. Push the `backend/` subdir as the Space root

Hugging Face expects the Dockerfile at the repo root, but our monorepo nests it under `backend/`. Use `git subtree` to push just that folder.

```bash
# from the monorepo root
git remote add hf https://huggingface.co/spaces/<owner>/fluxbill
git subtree push --prefix backend hf main
```

You'll be prompted for credentials. Use your HF username and an HF access token (Settings → Access Tokens → Write).

### 3c. Set Space secrets

In the Space's *Settings → Variables and secrets*:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL from step 1 |
| `OPENROUTER_API_KEY` | from step 2 |
| `OPENROUTER_MODEL` | `meta-llama/llama-3.1-8b-instruct:free` |
| `CORS_ORIGINS` | _set after Vercel deploy_ (step 4) |
| `WHISPER_MODEL` | `tiny` |
| `SEED_ON_STARTUP` | `true` |

Save. The Space rebuilds. First build downloads PyTorch deps + pre-bakes the Whisper model — expect ~3–4 minutes.

### 3d. Smoke test

Open `https://<owner>-fluxbill.hf.space/healthz`. Expect `{"status":"ok"}`. Then `/api/initial-state` should return seeded customers and subscriptions.

## 4. Deploy the frontend to Vercel

1. https://vercel.com/new — import `bpn2048/fluxbill`.
2. **Root Directory**: `frontend`.
3. **Framework**: Vite (auto-detected from `vercel.json`).
4. **Environment Variables** (build-time, inlined into the bundle):
   - `VITE_BACKEND_URL=https://<owner>-fluxbill.hf.space`
5. Deploy. You'll get `https://fluxbill-<hash>.vercel.app` and your project URL `https://fluxbill.vercel.app` once you claim it.

## 5. Close the CORS loop

Go back to the HF Space settings and update `CORS_ORIGINS` to include the Vercel URL:

```
CORS_ORIGINS=https://fluxbill.vercel.app,https://fluxbill-<hash>.vercel.app
```

The `CORS_ORIGIN_REGEX` default `^https?://.*\.vercel\.app$` already covers preview deployments, so this list only needs the canonical names if you change the regex.

Restart the Space (Settings → *Restart this Space*).

## 6. End-to-end test

1. Open the Vercel URL.
2. Dashboard should load with seeded customers/invoices/subscriptions.
3. Click the assistant widget → type `open invoices` → tab should switch.
4. Click the mic → say `open customers` → tab should switch.
5. Type `create invoice for apex 25000 INR` → the assistant should call the create endpoint and the row should appear.

If any step fails, check the HF Space *Logs* tab and the browser console for CORS errors.

---

## Custom domain (optional, free)

If you want a friendlier URL than `fluxbill.vercel.app`:

- **Free options**: a `*.tech` student domain, [Freenom](https://freenom.com) (`.tk`, `.ml` — increasingly restricted), or [is-a.dev](https://is-a.dev) (free developer subdomain via PR).
- Add it as a custom domain in Vercel; Vercel issues a Let's Encrypt cert automatically.
- No DNS change needed for the backend — the HF subdomain stays.

## Tearing it down

- Vercel project → *Settings → Delete*.
- HF Space → *Settings → Delete this Space*.
- Neon project → *Settings → Delete project*.
- OpenRouter key → revoke from *Keys*.
