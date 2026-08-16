import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { nanoid } from "nanoid";

import { config } from "../../config.js";

export type MidnightJobInput = {
  jobId: string;
  kind: string;
  payload: Record<string, unknown>;
  submittedTxHash?: string;
};

export type MidnightJobResult = {
  status:
    | "queued"
    | "preparing"
    | "proving"
    | "submitted"
    | "observed"
    | "finalized"
    | "retryable_failure"
    | "permanent_failure";
  txHash?: string;
  contractAddress?: string;
  eventName?: string;
  eventPayload?: Record<string, unknown>;
  error?: string;
};

export interface MidnightProvider {
  network(): string;
  contractAddresses(): {
    handleRegistry?: string;
    listingRegistry?: string;
    escrow?: string;
    attestation?: string;
  };
  submitJob(input: MidnightJobInput): Promise<MidnightJobResult>;
  observeTx(txHash: string): Promise<MidnightJobResult>;
  buildFundChallenge(input: {
    escrowId: string;
    amount: string;
    asset: string;
    buyerMidnightAddress: string;
    jobCommitment: string;
  }): Promise<Record<string, unknown>>;
  buildClaimHandleChallenge(input: {
    handle: string;
    ownerCommitment: string;
    profileVersionHash: string;
  }): Promise<Record<string, unknown>>;
}

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../..");
const stateFile = path.join(repoRoot, "contracts-midnight", ".midnight-state.json");

type DeploymentState = {
  network?: string;
  contracts?: {
    handleRegistry?: string;
    listingRegistry?: string;
    escrow?: string;
    attestation?: string;
  };
};

function readState(): DeploymentState {
  if (!existsSync(stateFile)) return {};
  return JSON.parse(readFileSync(stateFile, "utf8")) as DeploymentState;
}

/**
 * Talks to a live Midnight node / indexer / proof server and the compiled
 * Compact contracts. There is no in-process simulator: if the node or
 * deployment is missing, jobs fail instead of minting fake hashes.
 */
export class MidnightJsProvider implements MidnightProvider {
  network(): string {
    const deployed = readState().network;
    if (config.MIDNIGHT_NETWORK === "local") {
      return `midnight:${deployed ?? "undeployed"}`;
    }
    if (deployed !== config.MIDNIGHT_NETWORK) {
      return "midnight:undeployed";
    }
    return `midnight:${config.MIDNIGHT_NETWORK}`;
  }

  contractAddresses() {
    const contracts = readState().contracts ?? {};
    return {
      handleRegistry: config.HANDLE_REGISTRY_ADDRESS ?? contracts.handleRegistry,
      listingRegistry: config.LISTING_REGISTRY_ADDRESS ?? contracts.listingRegistry,
      escrow: config.ESCROW_CONTRACT_ADDRESS ?? contracts.escrow,
      attestation: config.ATTESTATION_CONTRACT_ADDRESS ?? contracts.attestation,
    };
  }

  async submitJob(input: MidnightJobInput): Promise<MidnightJobResult> {
    if (this.network() === "midnight:undeployed") {
      return {
        status: "permanent_failure",
        error: "Midnight deployment state does not match the configured network.",
      };
    }
    if (input.submittedTxHash) {
      return this.observeTx(input.submittedTxHash);
    }
    const addresses = this.contractAddresses();
    const required =
      input.kind.startsWith("handle")
        ? addresses.handleRegistry
        : input.kind.startsWith("listing")
          ? addresses.listingRegistry
          : input.kind.startsWith("escrow")
            ? addresses.escrow
            : addresses.attestation;
    if (!required) {
      return {
        status: "permanent_failure",
        error:
          "Midnight contracts are not deployed. Start the local node, compile, and deploy: pnpm midnight:up && pnpm midnight:compile && pnpm midnight:deploy",
      };
    }

    try {
      const callModule = (await import(
        pathToFileURL(path.join(repoRoot, "contracts-midnight", "scripts", "call.ts")).href
      )) as {
        callCircuit: (input: { contract: string; circuit: string; args: Array<unknown> }) => Promise<{
          txHash: string;
          contractAddress: string;
        }>;
        jobToCircuitCall: (
          kind: string,
          payload: Record<string, unknown>,
        ) => { contract: string; circuit: string; args: Array<unknown> };
      };
      const { callCircuit, jobToCircuitCall } = callModule;
      const call = jobToCircuitCall(input.kind, input.payload);
      const result = await callCircuit(call);
      return {
        status: "finalized",
        txHash: result.txHash,
        contractAddress: result.contractAddress,
        eventName: `${input.kind}.finalized`,
        eventPayload: { jobId: input.jobId, kind: input.kind, ...input.payload },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Midnight submitJob failed", message);
      return {
        status: "retryable_failure",
        error: message,
      };
    }
  }

  async observeTx(txHash: string): Promise<MidnightJobResult> {
    if (!txHash || txHash.startsWith("mn_tx_")) {
      return {
        status: "permanent_failure",
        error: "Refusing simulated transaction hashes. Submit a real Midnight tx.",
      };
    }
    try {
      const indexer = config.MIDNIGHT_INDEXER_URL;
      const response = await fetch(indexer, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: `query ($hash: String!) { transaction(hash: $hash) { hash } }`,
          variables: { hash: txHash },
        }),
      });
      if (!response.ok) {
        return { status: "retryable_failure", txHash, error: `indexer http ${response.status}` };
      }
      const body = (await response.json()) as { data?: { transaction?: { hash?: string } } };
      if (body.data?.transaction?.hash) {
        return { status: "finalized", txHash };
      }
      return { status: "submitted", txHash };
    } catch (error) {
      return {
        status: "retryable_failure",
        txHash,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async buildFundChallenge(input: {
    escrowId: string;
    amount: string;
    asset: string;
    buyerMidnightAddress: string;
    jobCommitment: string;
  }): Promise<Record<string, unknown>> {
    return {
      scheme: "midnight-exact",
      network: this.network(),
      contract: this.contractAddresses().escrow,
      method: "fundEscrow",
      escrowId: input.escrowId,
      amount: input.amount,
      asset: input.asset,
      buyer: input.buyerMidnightAddress,
      jobCommitment: input.jobCommitment,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      nonce: nanoid(),
    };
  }

  async buildClaimHandleChallenge(input: {
    handle: string;
    ownerCommitment: string;
    profileVersionHash: string;
  }): Promise<Record<string, unknown>> {
    return {
      scheme: "midnight-exact",
      network: this.network(),
      contract: this.contractAddresses().handleRegistry,
      method: "claimHandle",
      handle: input.handle,
      ownerCommitment: input.ownerCommitment,
      profileVersionHash: input.profileVersionHash,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      nonce: nanoid(),
    };
  }
}

export function createMidnightProvider(): MidnightProvider {
  return new MidnightJsProvider();
}
