# Step-by-Step Frontend Deployment Guide (Vercel)

This guide details deploying the `@tinyplace/website` Next.js frontend application directly from your GitHub repository `devndesigner6/tinyplace` to [Vercel](https://vercel.com/).

---

## Architecture & Configuration
- **GitHub Repository**: `devndesigner6/tinyplace`
- **Branch**: `main` (Auto-deploys on every `git push`)
- **Root Directory**: `website`
- **Vercel Config**: Includes pre-configured [vercel.json](file:///c:/Users/hp/tiny.place/website/vercel.json)

---

## Step 1: Import GitHub Repository to Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** $\rightarrow$ **Project**.
3. Select **Import** next to your GitHub repository: `devndesigner6/tinyplace`.

---

## Step 2: Configure Monorepo Settings

1. In the **Configure Project** screen:
   - **Project Name**: `tinyplace`
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and select `website`
2. Vercel automatically detects [website/vercel.json](file:///c:/Users/hp/tiny.place/website/vercel.json):
   ```json
   {
     "framework": "nextjs",
     "installCommand": "pnpm install",
     "buildCommand": "pnpm --filter @tinyhumansai/tinyplace build && pnpm --filter @tinyplace/website build"
   }
   ```

---

## Step 3: Add Environment Variables

Add the following environment variables:

| Key | Value / Instructions |
| :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://tinyplace-backend.onrender.com` *(Your live Render backend service URL)* |
| `NEXT_PUBLIC_MIDNIGHT_NETWORK` | `undeployed` *(or `preprod` for public testnet)* |
| `NEXT_PUBLIC_SITE_URL` | `https://tinyplace.vercel.app` |

---

## Step 4: Deploy & Verify Frontend

1. Click **Deploy**. Vercel will build `@tinyhumansai/tinyplace` SDK and compile `@tinyplace/website`.
2. Once complete, click **Visit** (e.g. `https://tinyplace.vercel.app`).
3. Verify that the top-right network badge shows **`MIDNIGHT · CHAIN READY`** in green.

---

## Step 5: Update Backend CORS on Render

Now that your Vercel URL is live (e.g. `https://tinyplace.vercel.app`):
1. Return to [Render Dashboard](https://dashboard.render.com/) $\rightarrow$ `tinyplace-backend` $\rightarrow$ **Environment**.
2. Update `CORS_ORIGIN` to your exact Vercel URL:
   ```env
   CORS_ORIGIN=https://tinyplace.vercel.app
   ```
3. Save changes to allow frontend requests from Vercel.
