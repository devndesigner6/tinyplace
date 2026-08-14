import { sha256 } from "@noble/hashes/sha2.js";

import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";

import { GENESIS_SEED, UndeployedConfig, contractsRoot } from "./config.ts";
import {
  CONTRACT_FOLDERS,
  loadCompiledContract,
  readDeploymentState,
  type ContractKey,
} from "./deploy.ts";
import { createContractProviders, managedPath } from "./providers.ts";
import { buildWalletFromHexSeed, closeWallet } from "./wallet.ts";

export type CircuitCall = {
  contract: ContractKey;
  circuit: string;
  args: Array<unknown>;
};

function hexToBytes32(value: string): Uint8Array {
  const clean = value.replace(/^0x/u, "");
  if (/^[0-9a-fA-F]{64}$/u.test(clean)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  return sha256(new TextEncoder().encode(value));
}

function toCircuitArg(value: unknown): unknown {
  if (typeof value === "bigint" || typeof value === "number") {
    return BigInt(value);
  }
  if (typeof value === "string") {
    if (/^\d+$/u.test(value)) return BigInt(value);
    return hexToBytes32(value);
  }
  return value;
}

export function jobToCircuitCall(kind: string, payload: Record<string, unknown>): CircuitCall {
  switch (kind) {
    case "handle_claim":
      return {
        contract: "handleRegistry",
        circuit: "claimHandle",
        args: [
          payload["handle"] ?? payload["handle_hash"],
          payload["ownerCommitment"],
          payload["profileVersionHash"],
          payload["expiresAt"] ?? BigInt(Math.floor(Date.now() / 1000) + 365 * 24 * 3600),
        ],
      };
    case "listing_anchor":
      return {
        contract: "listingRegistry",
        circuit: "anchorListing",
        args: [
          payload["listingId"],
          payload["sellerCommitment"] ?? payload["listingId"],
          payload["contentHash"] ?? payload["version_hash"],
          payload["priceAmount"] ?? 0,
          payload["acceptedToken"] ?? "NIGHT",
        ],
      };
    case "escrow_create":
      return {
        contract: "escrow",
        circuit: "createEscrow",
        args: [
          payload["escrowId"],
          payload["buyerCommitment"] ?? payload["client"],
          payload["sellerCommitment"] ?? payload["provider"],
          payload["amount"] ?? 0,
          payload["asset"] ?? "NIGHT",
          payload["listingVersionHash"] ?? payload["escrowId"],
          payload["jobCommitment"] ?? payload["escrowId"],
          payload["deadline"] ?? BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600),
        ],
      };
    case "escrow_fund":
      return { contract: "escrow", circuit: "fundEscrow", args: [payload["escrowId"]] };
    case "escrow_deliver":
      return { contract: "escrow", circuit: "deliverEscrow", args: [payload["escrowId"]] };
    case "escrow_accept":
      return { contract: "escrow", circuit: "acceptDelivery", args: [payload["escrowId"]] };
    case "escrow_release":
      return { contract: "escrow", circuit: "releaseEscrow", args: [payload["escrowId"]] };
    case "escrow_dispute":
      return { contract: "escrow", circuit: "disputeEscrow", args: [payload["escrowId"]] };
    case "escrow_refund":
      return { contract: "escrow", circuit: "refundEscrow", args: [payload["escrowId"]] };
    case "attestation_anchor":
      return {
        contract: "attestation",
        circuit: "anchorAttestation",
        args: [
          payload["attestationId"] ?? payload["outputHash"],
          payload["outputHash"],
          payload["jobCommitment"],
          payload["issuerCommitment"],
          payload["issuedAt"] ?? BigInt(Math.floor(Date.now() / 1000)),
        ],
      };
    default:
      throw new Error(`Unknown Midnight job kind: ${kind}`);
  }
}

export async function callCircuit(input: CircuitCall): Promise<{ txHash: string; contractAddress: string }> {
  const state = readDeploymentState();
  const address = state?.contracts[input.contract];
  if (!address) {
    throw new Error(`${input.contract} is not deployed. Run: pnpm --filter @tinyplace/midnight deploy`);
  }
  const config = new UndeployedConfig();
  const wallet = await buildWalletFromHexSeed(config, GENESIS_SEED);
  try {
    const folder = CONTRACT_FOLDERS[input.contract];
    const providers = createContractProviders(config, wallet, managedPath(contractsRoot, folder));
    const compiled = await loadCompiledContract(folder, input.contract);
    const found = await findDeployedContract(providers, {
      contractAddress: address,
      compiledContract: compiled,
      privateStateId: `tinyplace-${input.contract}`,
      initialPrivateState: {},
    });
    const args = input.args.map(toCircuitArg);
    const callTx = found.callTx as Record<string, (...circuitArgs: Array<unknown>) => Promise<{ public: { txId: string } }>>;
    const circuit = callTx[input.circuit];
    if (typeof circuit !== "function") {
      throw new Error(`Circuit ${input.circuit} is not on ${input.contract}`);
    }
    const result = await circuit(...args);
    return { txHash: result.public.txId, contractAddress: address };
  } finally {
    await closeWallet(wallet);
  }
}

async function main(): Promise<void> {
  const kind = process.argv[2];
  const payloadJson = process.argv[3] ?? "{}";
  if (!kind) {
    console.error("Usage: pnpm --filter @tinyplace/midnight call <kind> '<json payload>'");
    process.exit(1);
  }
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  const call = jobToCircuitCall(kind, payload);
  const result = await callCircuit(call);
  console.log(JSON.stringify({ kind, ...result }, null, 2));
}

if (process.argv[1]?.includes("call.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
