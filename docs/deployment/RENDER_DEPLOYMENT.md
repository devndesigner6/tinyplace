# Step-by-Step Backend Deployment Guide (Render)

This guide details deploying the `@tinyplace/backend` Node.js service directly from your GitHub repository `devndesigner6/tinyplace` to [Render](https://render.com/).

---

## Exact Render Web Service Settings (Backend Only)

### 1. Build Command
Copy and paste this exact command into the **Build Command** field on Render:
```bash
pnpm install && pnpm --filter @tinyplace/backend build
```

*(Note: If database migrations were not run yet, use: `pnpm install && pnpm --filter @tinyplace/backend db:migrate && pnpm --filter @tinyplace/backend build`)*

### 2. Start Command
Copy and paste this exact command into the **Start Command** field on Render:
```bash
pnpm --filter @tinyplace/backend start
```

---

## Step-by-Step Render Dashboard Configuration

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Select your Web Service: `tinyplace-backend`.
3. Go to **Settings** in the left menu.
4. Update the fields:
   - **Build Command**: `pnpm install && pnpm --filter @tinyplace/backend build`
   - **Start Command**: `pnpm --filter @tinyplace/backend start`
5. Go to **Environment** tab and ensure the variables are set:
   - `NODE_ENV`: `production`
   - `PORT`: `8080`
   - `DATABASE_URL`: *(Your Render PostgreSQL internal URL)*
   - `REDIS_URL`: *(Your Render Redis internal URL)*
   - `MIDNIGHT_NETWORK`: `preprod`
   - `CORS_ORIGIN`: `https://tinyplace.vercel.app`
6. Click **Save Changes** and click **Manual Deploy** $\rightarrow$ **Deploy latest commit**.
