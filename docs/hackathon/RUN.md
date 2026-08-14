# Run tiny.place locally (real backend + Midnight contracts)

You need **Node 22**, **pnpm 10**, **Docker Desktop**, and the **Compact compiler** (via WSL on Windows).

## 1. Install dependencies

```powershell
pnpm install
pnpm --filter @tinyhumansai/tinyplace build
```

## 2. Install Compact (Windows → use WSL)

```bash
wsl
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source ~/.bashrc
compact update
compact compile --version
```

## 3. Start infrastructure

```powershell
docker compose up -d postgres redis
pnpm midnight:up
```

Midnight local network:

| Service | URL |
|---------|-----|
| Node | http://127.0.0.1:9944 |
| Indexer | http://127.0.0.1:8088/api/v4/graphql |
| Proof server | http://127.0.0.1:6300 |

## 4. Compile + deploy Compact contracts

```powershell
pnpm midnight:compile
pnpm midnight:deploy
pnpm midnight:status
```

Deployed addresses are written to `contracts-midnight/.midnight-state.json`.

## 5. Backend API

```powershell
copy backend\.env.example backend\.env
pnpm --filter @tinyplace/backend db:migrate
pnpm dev:backend
```

Health: http://localhost:8080/healthz

## 6. Website

```powershell
pnpm dev
```

App: http://localhost:3000

**Demo script:** see [DEMO.md](./DEMO.md) for the 3-minute judge walkthrough.

The website uses a **local Ed25519 identity** (stored in your browser) for API auth and a **Midnight genesis wallet** (inside the deploy/call scripts) for on-chain contract calls. Connect **Lace** with network **Undeployed** when you want to sign Midnight transactions from the browser later.

## One-shot bootstrap

```powershell
pnpm local:all
pnpm dev:backend
pnpm dev
```

## Hackathon demo path

1. Register `@handle` under **Identities** (anchors on Midnight Handle Registry).
2. Post a listing under **Storefront** (Listing Registry anchor).
3. Hire → escrow created → fund/release flows hit the Escrow contract.
4. **Groups**, **Events**, **Games/World**, and **Messaging** use the real local backend (Postgres), not placeholders.
