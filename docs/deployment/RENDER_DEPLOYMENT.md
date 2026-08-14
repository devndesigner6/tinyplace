# Step-by-Step Backend Deployment Guide (Render)

This guide details deploying the `@tinyplace/backend` Node.js service directly from your GitHub repository `devndesigner6/tinyplace` to [Render](https://render.com/).

> [!IMPORTANT]
> **Deploy Render FIRST!**
> You must deploy Render before Vercel because Vercel requires your live Render Backend URL (`NEXT_PUBLIC_API_BASE_URL`) at build time.

---

## Architecture & GitHub Integration Overview
- **GitHub Repository**: `devndesigner6/tinyplace`
- **Branch**: `main` (Auto-deploys on every `git push`)
- **Backend Service**: `@tinyplace/backend` (Hono Node API Server)
- **Database**: Render Managed PostgreSQL v16
- **Cache**: Render Managed Redis

---

## Step 1: Provision PostgreSQL Database

1. Open [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\rightarrow$ **PostgreSQL**.
3. Configure details:
   - **Name**: `tinyplace-db`
   - **Database**: `tinyplace`
   - **User**: `tinyplace`
   - **Region**: Choose your preferred region (e.g. Frankfurt / Oregon / Singapore)
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (e.g., `postgres://tinyplace:password@dpg-xxx-a/tinyplace`).

---

## Step 2: Provision Redis Instance

1. In Render Dashboard, click **New +** $\rightarrow$ **Redis**.
2. Configure details:
   - **Name**: `tinyplace-redis`
   - **Plan**: Free or Starter
3. Click **Create Redis**.
4. Once created, copy the **Internal Redis URL** (e.g., `redis://red-xxx:6379`).

---

## Step 3: Create Web Service from GitHub Repository

1. In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Under **Connect a repository**, select `devndesigner6/tinyplace`.
3. Configure Web Service settings:
   - **Name**: `tinyplace-backend`
   - **Language**: `Node`
   - **Branch**: `main`
   - **Region**: Same region as Postgres & Redis
   - **Root Directory**: *(Leave blank to default to monorepo root)*
   - **Build Command**:
     ```bash
     pnpm install && pnpm --filter @tinyplace/backend db:migrate
     ```
   - **Start Command**:
     ```bash
     pnpm --filter @tinyplace/backend start
     ```

---

## Step 4: Configure Environment Variables

Under **Environment** tab, add:

| Key | Value / Instructions |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `DATABASE_URL` | *(Paste Internal Database URL from Step 1)* |
| `REDIS_URL` | *(Paste Internal Redis URL from Step 2)* |
| `CORS_ORIGIN` | `https://tinyplace.vercel.app` *(Your Vercel frontend URL)* |
| `MIDNIGHT_NETWORK` | `preprod` |
| `MIDNIGHT_RPC_URL` | `https://rpc.preprod.midnight.network` |
| `MIDNIGHT_INDEXER_URL` | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| `MIDNIGHT_PROOF_SERVER_URL` | `http://127.0.0.1:6300` |
| `HANDLE_REGISTRY_ADDRESS` | `591eba4aa1fcd56b5abff6dd76101bfde13633b99cf2dca4b43ef58648833784` |
| `LISTING_REGISTRY_ADDRESS` | `55b3c62de8fdbcaa3ddb20a7100291b7410968bcaefb3b821718368b8848bf4e` |
| `ESCROW_CONTRACT_ADDRESS` | `f5a640d646abe63b99dbe4190453c8750d5de2cd4c27752c9ed2895faec695c9` |
| `ATTESTATION_CONTRACT_ADDRESS` | `573468ffcd9b06e89a631696a40224315a21c05728e1f29cbde40cd1dcfe60da` |
| `SETTLEMENT_NETWORK` | `midnight` |
| `HACKATHON_DEV_MODE` | `true` |

---

## Step 5: Deploy & Get Backend URL

1. Click **Create Web Service**.
2. Render will pull from `devndesigner6/tinyplace:main`, run migrations, and start the service.
3. Copy your live Render URL (e.g. `https://tinyplace-backend.onrender.com`).
4. Test health endpoint: `https://tinyplace-backend.onrender.com/healthz`
