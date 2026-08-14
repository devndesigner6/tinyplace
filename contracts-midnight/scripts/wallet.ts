import {
  DustSecretKey,
  LedgerParameters,
  nativeToken,
  ZswapSecretKeys,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import {
  DustAddress,
  MidnightBech32m,
  type UnshieldedKeystore,
  type WalletFacade,
} from "@midnight-ntwrk/wallet-sdk";
import {
  FluentWalletBuilder,
  type DustWalletOptions,
} from "@midnight-ntwrk/testkit-js";
import * as Rx from "rxjs";
import { WebSocket } from "ws";

import type { MidnightNetworkConfig } from "./config.ts";

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

export type WalletContext = {
  wallet: WalletFacade;
  shieldedSecretKeys: ZswapSecretKeys;
  dustSecretKey: DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
};

const DUST_OPTIONS: DustWalletOptions = {
  ledgerParams: LedgerParameters.initialParameters().dust,
  additionalFeeOverhead: 1_000n,
  feeBlocksMargin: 5,
};

function isStrictlyComplete(progress: unknown): boolean {
  if (!progress || typeof progress !== "object") return false;
  const fn = (progress as { isStrictlyComplete?: unknown }).isStrictlyComplete;
  return typeof fn === "function" && (fn as () => boolean).call(progress);
}

export async function buildWalletFromHexSeed(
  config: MidnightNetworkConfig,
  hexSeed: string,
): Promise<WalletContext> {
  const builder = FluentWalletBuilder.forEnvironment(config.envConfig())
    .withDustOptions(DUST_OPTIONS)
    .withSeed(hexSeed);
  const { wallet, seeds, keystore } = await builder.buildWithoutStarting();
  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  await waitForSync(wallet);
  const ctx: WalletContext = {
    wallet,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore: keystore,
  };
  const balances = await displayWalletBalances(ctx, config);
  if (balances.unshielded + balances.shielded === 0n) {
    await waitForFunds(wallet);
  }
  await registerNightForDust(ctx);
  return ctx;
}

function isComplete(progress: { status: string }): boolean {
  return progress.status === "synced" || progress.status === "syncing";
}

export function waitForSync(wallet: WalletFacade, timeout = 30_000): Promise<unknown> {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.filter((state) => Boolean(state.unshielded) && Boolean(state.dust)),
      Rx.timeout({
        each: timeout,
        with: () => Rx.throwError(() => new Error(`Wallet sync timeout after ${timeout}ms`)),
      }),
    ),
  );
}

export function waitForFunds(wallet: WalletFacade, timeout = 300_000): Promise<unknown> {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.map(
        (state) =>
          (state.unshielded?.balances[nativeToken().raw] ?? 0n) +
          (state.shielded?.balances[nativeToken().raw] ?? 0n),
      ),
      Rx.filter((balance) => balance > 0n),
      Rx.timeout({
        each: timeout,
        with: () => Rx.throwError(() => new Error(`Wallet did not receive funds within ${timeout}ms`)),
      }),
    ),
  );
}

export async function displayWalletBalances(
  walletContext: WalletContext,
  config: MidnightNetworkConfig,
): Promise<{ unshielded: bigint; shielded: bigint; dust: bigint; address: string }> {
  const state = await Rx.firstValueFrom(walletContext.wallet.state());
  const unshielded = state.unshielded?.balances[nativeToken().raw] ?? 0n;
  const shielded = state.shielded?.balances[nativeToken().raw] ?? 0n;
  const dust = state.dust?.balance(new Date()) ?? 0n;
  const address = walletContext.unshieldedKeystore.getBech32Address().asString();
  const shieldedAddr = MidnightBech32m.encode(config.networkId, state.shielded.address).asString();
  const dustAddr = DustAddress.encodePublicKey(config.networkId, walletContext.dustSecretKey.publicKey);
  console.log(`Midnight genesis wallet: ${address}`);
  console.log(`Shielded: ${shieldedAddr}`);
  console.log(`DUST: ${dustAddr}`);
  console.log(`NIGHT: ${unshielded + shielded}  DUST: ${dust}`);
  return { unshielded, shielded, dust, address };
}

export async function registerNightForDust(walletContext: WalletContext): Promise<void> {
  const state = await Rx.firstValueFrom(
    walletContext.wallet.state().pipe(Rx.filter((s) => Boolean(s.unshielded) && Boolean(s.dust))),
  );
  if ((state.dust?.availableCoins.length ?? 0) >= 1 || (state.dust?.balance(new Date()) ?? 0n) > 0n) {
    return;
  }
  const unregistered =
    state.unshielded?.availableCoins.filter((coin) => coin.meta.registeredForDustGeneration === false) ??
    [];
  if (unregistered.length === 0) {
    return;
  }
  console.log(`Registering ${unregistered.length} NIGHT UTXO(s) for DUST...`);
  const recipe = await walletContext.wallet.registerNightUtxosForDustGeneration(
    unregistered,
    walletContext.unshieldedKeystore.getPublicKey(),
    (payload) => walletContext.unshieldedKeystore.signData(payload),
  );
  const finalizedTx = await walletContext.wallet.finalizeRecipe(recipe);
  const txId = await walletContext.wallet.submitTransaction(finalizedTx);
  console.log(`DUST registration submitted: ${txId}`);
}

export function waitForSpendableDust(walletContext: WalletContext, timeout = 180_000): Promise<unknown> {
  return Rx.firstValueFrom(
    walletContext.wallet.state().pipe(
      Rx.filter((s) => (s.dust?.availableCoins.length ?? 0) >= 1),
      Rx.timeout({
        each: timeout,
        with: () => Rx.throwError(() => new Error(`No spendable DUST coin within ${timeout}ms`)),
      }),
    ),
  );
}

export async function closeWallet(walletContext: WalletContext): Promise<void> {
  try {
    await walletContext.wallet.stop();
  } catch (error) {
    console.error("Error closing wallet", error);
  }
}
