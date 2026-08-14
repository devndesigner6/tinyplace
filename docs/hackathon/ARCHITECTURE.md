# Hackathon Architecture — tiny.place + Midnight

## Trust model

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Website    │────►│  Backend API    │────►│  PostgreSQL      │
│   + SDK      │     │  (projections)  │     │  (read models)   │
└──────┬───────┘     └────────┬────────┘     └──────────────────┘
       │                      │
       │ Midnight wallet      │ Worker + Indexer
       ▼                      ▼
┌──────────────────────────────────────────────────────────────┐
│  Midnight Preview / Preprod                                   │
│  Handle Registry │ Listing Registry │ Escrow │ Attestation   │
└──────────────────────────────────────────────────────────────┘
```

**Chain-authoritative:** handle ownership, escrow fund/release/refund, listing version commitments.

**Off-chain:** Signal ciphertext, search, profiles, encrypted artifacts (hash on-chain when needed).

## Escrow lifecycle

```
created → pending_fund → funded → delivered → accepted_delivery → released
                              ↘ disputed → resolved/refunded
```

API mutations call `createChainJob()`; escrow rows with `chain_authoritative=true` only advance when the worker/indexer confirms the contract event.

## Contracts

| Contract | Path |
|----------|------|
| Handle Registry | `contracts-midnight/handle-registry/handle.compact` |
| Listing Registry | `contracts-midnight/listing-registry/listing.compact` |
| Escrow | `contracts-midnight/escrow/escrow.compact` |
| Attestation | `contracts-midnight/attestation/attestation.compact` |

Deploy with Midnight Compact compiler + Midnight.js (see [Midnight deploy guide](https://docs.midnight.network/guides/deploy-mn-app)).

## Demo runbook

See [DEMO.md](./DEMO.md).
