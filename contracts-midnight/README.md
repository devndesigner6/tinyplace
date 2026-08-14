# Midnight Contracts — tiny.place

Compact smart contracts for the Brainwave 2026 Midnight track.

| Contract | Source | Circuits |
|----------|--------|----------|
| Handle Registry | `handle-registry/handle.compact` | `claimHandle`, `deactivateHandle` |
| Listing Registry | `listing-registry/listing.compact` | `anchorListing` |
| Escrow | `escrow/escrow.compact` | create/fund/deliver/accept/release/dispute/refund |
| Attestation | `attestation/attestation.compact` | `anchorAttestation`, `revokeAttestation` |

## Compile

Requires the [Compact toolchain](https://docs.midnight.network/getting-started/installation) (`compact compile`).

```powershell
pnpm --filter @tinyplace/midnight compile
```

Outputs land in `*/managed/` (gitignored).

## Deploy to local undeployed network

Start the local Midnight stack first (`pnpm midnight:up` from repo root), then:

```powershell
pnpm --filter @tinyplace/midnight deploy
pnpm --filter @tinyplace/midnight status
```

Addresses are saved to `.midnight-state.json` and picked up automatically by `@tinyplace/backend`.

## Preprod

Deploy with Lace + funded wallet, then set addresses in `backend/.env`:

```env
MIDNIGHT_NETWORK=preprod
HANDLE_REGISTRY_ADDRESS=...
LISTING_REGISTRY_ADDRESS=...
ESCROW_CONTRACT_ADDRESS=...
ATTESTATION_CONTRACT_ADDRESS=...
```
