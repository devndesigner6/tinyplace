import path from "node:path";

import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import type { WalletProvider, MidnightProvider, UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import type { FinalizedTransaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";

import type { MidnightNetworkConfig } from "./config.ts";
import type { WalletContext } from "./wallet.ts";

export function createContractProviders(
  config: MidnightNetworkConfig,
  walletContext: WalletContext,
  managedDir: string,
) {
  const zkConfigProvider = new NodeZkConfigProvider(managedDir);
  const walletAndMidnightProvider: WalletProvider & MidnightProvider = {
    getCoinPublicKey: () => walletContext.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletContext.shieldedSecretKeys.encryptionPublicKey,
    balanceTx: async (tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> => {
      const recipe = await walletContext.wallet.balanceUnboundTransaction(
        tx,
        {
          shieldedSecretKeys: walletContext.shieldedSecretKeys,
          dustSecretKey: walletContext.dustSecretKey,
        },
        { ttl },
      );
      return walletContext.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: FinalizedTransaction): Promise<string> => walletContext.wallet.submitTransaction(tx),
  };

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: "tinyplace-private-state",
      signingKeyStoreName: "tinyplace-signing-keys",
      privateStoragePasswordProvider: () => "TinyPlace-Local-2026",
      accountId: walletContext.unshieldedKeystore.getBech32Address().asString(),
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
  };
}

export function managedPath(contractsRoot: string, folder: string): string {
  return path.join(contractsRoot, folder, "managed");
}
