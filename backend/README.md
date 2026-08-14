# tiny.place Backend

Self-hosted API for the tiny.place hackathon fork. PostgreSQL holds **projections**; Midnight contracts are the **source of truth** for handle ownership and escrow settlement.

## Quick start

```bash
# From repo root
docker compose up -d postgres redis
cp backend/.env.example backend/.env
pnpm install
pnpm --filter @tinyplace/backend db:migrate
pnpm dev:backend
```

API: `http://localhost:8080/healthz`

Point the website at your backend:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## Services

| Process | Command | Port |
|---------|---------|------|
| API | `pnpm dev:backend` | 8080 |
| Worker | `pnpm --filter @tinyplace/backend dev:worker` | — |
| Indexer | `pnpm --filter @tinyplace/backend dev:indexer` | — |
| MCP gateway | `pnpm --filter @tinyplace/backend dev:mcp` | 8081 |

## Midnight modes

| `MIDNIGHT_NETWORK` | Behavior |
|--------------------|----------|
| `local` | In-process contract simulator; txs finalize immediately for dev |
| `preprod` / `preview` | Real Midnight.js + indexer (requires proof server + deployed contracts) |

Set contract addresses in `.env` after deploying `contracts-midnight/`.

## Core API surfaces

- Identity: `/registry/names/*`
- Directory: `/directory/*`
- Messaging relay: `/keys/*`, `/messages`
- Marketplace + jobs: `/marketplace/products`, `/jobs/*`
- Escrow (Midnight-gated): `/escrow/*`
- Chain jobs: `/chain/jobs/:id`
- Ledger (projected): `/ledger/transactions`

## Architecture

See [docs/hackathon/ARCHITECTURE.md](../docs/hackathon/ARCHITECTURE.md).
