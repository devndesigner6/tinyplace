# Step-by-Step Backend Deployment Guide (Render)

This guide walks you through deploying the `@tinyplace/backend` service, PostgreSQL database, and Redis instance on [Render](https://render.com/).

---

## Architecture Overview
- **Service**: `@tinyplace/backend` (Node.js / Hono API Server)
- **Database**: Render Managed PostgreSQL v16
- **Cache**: Render Managed Redis
- **Port**: `8080` (or `PORT` dynamically provided by Render)

---

## Step 1: Provision PostgreSQL Database

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\rightarrow$ **PostgreSQL**.
3. Fill in the database details:
   - **Name**: `tinyplace-db`
   - **Database**: `tinyplace`
   - **User**: `tinyplace`
   - **Region**: Choose closest region (e.g., Oregon / Frankfurt / Singapore)
   - **Plan**: Free or Starter
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (e.g., `postgres://tinyplace:password@dpg-xxx-a/tinyplace`).

---

## Step 2: Provision Redis Instance

1. In Render Dashboard, click **New +** $\rightarrow$ **Redis**.
2. Fill in the Redis details:
   - **Name**: `tinyplace-redis`
   - **Plan**: Free or Starter
3. Click **Create Redis**.
4. Once active, copy the **Internal Redis URL** (e.g., `redis://red-xxx:6379`).

---

## Step 3: Create Web Service for Backend

1. In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your Git repository (`tiny.place`).
3. Configure the Web Service settings:
   - **Name**: `tinyplace-backend`
   - **Language**: `Node`
   - **Branch**: `main` (or active branch)
   - **Region**: Same region as Postgres/Redis
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

Under the **Environment** tab of your Web Service, add the following key-value pairs:

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

## Step 5: Deploy & Verify Backend Health

1. Click **Deploy Web Service**.
2. Monitor the deployment logs. Render will run `pnpm install`, execute `db:migrate`, and launch `pnpm start`.
3. Once the status shows **Live**, test your endpoint in a browser or curl:
   ```bash
   curl https://tinyplace-backend.onrender.com/healthz
   ```
4. Verify response:
   ```json
   {
     "status": "ok",
     "settlement": "midnight",
     "contractsReady": true,
     "hackathonDevFallback": false
   }
   ```
