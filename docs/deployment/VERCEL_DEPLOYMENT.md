# Step-by-Step Frontend Deployment Guide (Vercel)

This guide walks you through deploying the `@tinyplace/website` Next.js frontend application on [Vercel](https://vercel.com/).

---

## Architecture Overview
- **Application**: `@tinyplace/website` (Next.js 16 App Router)
- **Framework Preset**: Next.js
- **Root Directory**: `website`
- **Output Directory**: `.next`

---

## Step 1: Import Repository to Vercel

1. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your Git repository (`tiny.place`).

---

## Step 2: Configure Project Settings

1. In the **Configure Project** screen:
   - **Project Name**: `tinyplace`
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and select `website`
2. Expand the **Build and Output Settings** section:
   - **Build Command**:
     ```bash
     pnpm --filter @tinyplace/website build
     ```
   - **Install Command**:
     ```bash
     pnpm install
     ```

---

## Step 3: Configure Environment Variables

Expand the **Environment Variables** section and add:

| Key | Value / Instructions |
| :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://tinyplace-backend.onrender.com` *(Paste your Render backend service URL)* |
| `NEXT_PUBLIC_MIDNIGHT_NETWORK` | `undeployed` *(or `preprod` for public testnet)* |
| `NEXT_PUBLIC_SITE_URL` | `https://tinyplace.vercel.app` *(Your Vercel domain URL)* |

---

## Step 4: Deploy & Verify Frontend

1. Click **Deploy**.
2. Monitor Vercel build logs. Next.js will compile all static and dynamic pages.
3. Once deployment completes, click **Visit**.
4. Open the live site in your browser (e.g., `https://tinyplace.vercel.app`).
5. Verify the header status badge:
   - It should display **`MIDNIGHT · CHAIN READY`** with a green indicator.

---

## Step 5: Update CORS Origin on Render

After Vercel assigns your live frontend domain (`https://tinyplace.vercel.app`):
1. Go back to your [Render Dashboard](https://dashboard.render.com/) $\rightarrow$ `tinyplace-backend` $\rightarrow$ **Environment**.
2. Update `CORS_ORIGIN` to your exact Vercel URL:
   ```env
   CORS_ORIGIN=https://tinyplace.vercel.app
   ```
3. Save changes. Render will automatically redeploy the backend with the new CORS origin.
