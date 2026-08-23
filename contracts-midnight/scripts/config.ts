import path from "node:path";
import { fileURLToPath } from "node:url";

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export interface MidnightNetworkConfig {
  readonly networkId: string;
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly nodeWS: string;
  readonly proofServer: string;
  readonly faucet: string;
  envConfig(): EnvironmentConfiguration;
}

export class UndeployedConfig implements MidnightNetworkConfig {
  readonly networkId = "undeployed";
  readonly indexer = process.env.MIDNIGHT_INDEXER_URL ?? "http://127.0.0.1:8088/api/v4/graphql";
  readonly indexerWS = process.env.MIDNIGHT_INDEXER_WS ?? "ws://127.0.0.1:8088/api/v4/graphql/ws";
  readonly node = process.env.MIDNIGHT_RPC_URL ?? "http://127.0.0.1:9944";
  readonly nodeWS = process.env.MIDNIGHT_RPC_WS ?? "ws://127.0.0.1:9944";
  readonly proofServer = process.env.MIDNIGHT_PROOF_SERVER_URL ?? "http://127.0.0.1:6300";
  readonly faucet = "";

  constructor() {
    setNetworkId(this.networkId);
  }

  envConfig(): EnvironmentConfiguration {
    return {
      walletNetworkId: this.networkId,
      networkId: this.networkId,
      indexer: this.indexer,
      indexerWS: this.indexerWS,
      node: this.node,
      nodeWS: this.nodeWS,
      proofServer: this.proofServer,
      faucet: this.faucet,
    };
  }
}

export class PublicNetworkConfig implements MidnightNetworkConfig {
  readonly networkId: "preview" | "preprod";
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly nodeWS: string;
  readonly proofServer = process.env.MIDNIGHT_PROOF_SERVER_URL ?? "http://127.0.0.1:6300";
  readonly faucet: string;

  constructor(networkId: "preview" | "preprod") {
    this.networkId = networkId;
    this.indexer =
      process.env.MIDNIGHT_INDEXER_URL ??
      `https://indexer.${networkId}.midnight.network/api/v4/graphql`;
    this.indexerWS =
      process.env.MIDNIGHT_INDEXER_WS ??
      `wss://indexer.${networkId}.midnight.network/api/v4/graphql/ws`;
    this.node = process.env.MIDNIGHT_RPC_URL ?? `https://rpc.${networkId}.midnight.network`;
    this.nodeWS = process.env.MIDNIGHT_RPC_WS ?? `wss://rpc.${networkId}.midnight.network`;
    this.faucet = `https://midnight-tmnight-${networkId}.nethermind.dev/`;
    setNetworkId(this.networkId);
  }

  envConfig(): EnvironmentConfiguration {
    return {
      walletNetworkId: this.networkId,
      networkId: this.networkId,
      indexer: this.indexer,
      indexerWS: this.indexerWS,
      node: this.node,
      nodeWS: this.nodeWS,
      proofServer: this.proofServer,
      faucet: this.faucet,
    };
  }
}

export class PreviewConfig extends PublicNetworkConfig {
  constructor() {
    super("preview");
  }
}

export class PreprodConfig extends PublicNetworkConfig {
  constructor() {
    super("preprod");
  }
}

export function getNetworkConfig(): MidnightNetworkConfig {
  const env = (process.env.MIDNIGHT_NETWORK ?? "").toLowerCase();
  if (env === "preview") return new PreviewConfig();
  if (env === "preprod" || env === "testnet") return new PreprodConfig();
  return new UndeployedConfig();
}

export const contractsRoot = path.resolve(currentDir, "..");
export const statePath = path.join(contractsRoot, ".midnight-state.json");
export const GENESIS_SEED = process.env.MIDNIGHT_GENESIS_SEED ?? `${"0".repeat(63)}1`;
void currentDir;
