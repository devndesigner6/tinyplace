import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

import { GENESIS_SEED, UndeployedConfig, contractsRoot, statePath } from "./config.ts";
import { createContractProviders, managedPath } from "./providers.ts";
import { buildWalletFromHexSeed, closeWallet } from "./wallet.ts";

export type ContractKey = "handleRegistry" | "listingRegistry" | "escrow" | "attestation";

export const CONTRACT_FOLDERS: Record<ContractKey, string> = {
  handleRegistry: "handle-registry",
  listingRegistry: "listing-registry",
  escrow: "escrow",
  attestation: "attestation",
};

export type DeploymentState = {
  network: string;
  walletAddress: string;
  deployedAt: string;
  contracts: Partial<Record<ContractKey, string>>;
};

export function readDeploymentState(): DeploymentState | undefined {
  if (!existsSync(statePath)) return undefined;
  return JSON.parse(readFileSync(statePath, "utf8")) as DeploymentState;
}

export function writeDeploymentState(state: DeploymentState): void {
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

export async function loadCompiledContract(folder: string, name: string) {
  const managedDir = managedPath(contractsRoot, folder);
  const modulePath = path.join(managedDir, "contract", "index.js");
  if (!existsSync(modulePath)) {
    throw new Error(
      `Compiled contract missing at ${modulePath}. Run: pnpm --filter @tinyplace/midnight compile`,
    );
  }
  const module = (await import(pathToFileURL(modulePath).href)) as {
    Contract: new (...args: Array<never>) => unknown;
  };
  return CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses(CompiledContract.make(name, module.Contract), {}),
    managedDir,
  );
}

async function main(): Promise<void> {
  const config = new UndeployedConfig();
  console.log(`Deploying tiny.place Compact contracts to ${config.networkId}`);
  const wallet = await buildWalletFromHexSeed(config, GENESIS_SEED);
  const walletAddress = wallet.unshieldedKeystore.getBech32Address().asString();
  const existing = readDeploymentState() ?? {
    network: config.networkId,
    walletAddress,
    deployedAt: new Date().toISOString(),
    contracts: {},
  };

  try {
    for (const [key, folder] of Object.entries(CONTRACT_FOLDERS) as Array<[ContractKey, string]>) {
      if (existing.contracts[key]) {
        console.log(`${key} already deployed at ${existing.contracts[key]}`);
        continue;
      }
      const providers = createContractProviders(config, wallet, managedPath(contractsRoot, folder));
      const compiled = await loadCompiledContract(folder, key);
      console.log(`Deploying ${key}...`);
      const deployed = await deployContract(providers, {
        compiledContract: compiled,
        privateStateId: `tinyplace-${key}`,
        initialPrivateState: {},
      });
      const address = deployed.deployTxData.public.contractAddress;
      existing.contracts[key] = address;
      existing.deployedAt = new Date().toISOString();
      writeDeploymentState(existing);
      console.log(`${key} deployed at ${address}`);
    }
    console.log("\nDeployment complete:");
    console.log(JSON.stringify(existing, null, 2));
  } finally {
    await closeWallet(wallet);
  }
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
