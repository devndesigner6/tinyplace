"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { queryKeys } from "@src/common/query-keys";
import { useTinyplaceWallet } from "@src/common/tinyplace-wallet";

type WalletBalance = {
	amount: string;
	decimals: number;
	kind: "native" | "token";
	mint?: string;
	network: string;
	rawAmount: string;
	symbol: string;
};

const MIDNIGHT_NETWORK =
	process.env["NEXT_PUBLIC_MIDNIGHT_NETWORK"] ?? "undeployed";

export function formatUnits(rawAmount: bigint, decimals: number): string {
	const negative = rawAmount < 0n;
	const absolute = negative ? -rawAmount : rawAmount;
	const base = 10n ** BigInt(decimals);
	const whole = absolute / base;
	const fraction = absolute % base;

	if (decimals === 0 || fraction === 0n) {
		return `${negative ? "-" : ""}${whole.toString()}`;
	}

	const padded = fraction.toString().padStart(decimals, "0");
	const trimmed = padded.replace(/0+$/, "");
	return `${negative ? "-" : ""}${whole.toString()}.${trimmed}`;
}

export function useWalletBalancesForAddress(
	walletAddress: string | undefined
): UseQueryResult<Array<WalletBalance>> {
	const wallet = walletAddress ?? "";

	return useQuery({
		queryKey: queryKeys.payments.walletBalances(wallet),
		queryFn: (): Promise<Array<WalletBalance>> => {
			if (!wallet) {
				return Promise.resolve([]);
			}
			return Promise.resolve([
				{
					amount: "—",
					decimals: 6,
					kind: "native",
					network: `midnight:${MIDNIGHT_NETWORK}`,
					rawAmount: "0",
					symbol: "NIGHT",
				},
			]);
		},
		enabled: Boolean(wallet),
	});
}

export function useWalletBalances(): UseQueryResult<Array<WalletBalance>> {
	const { address } = useTinyplaceWallet();
	return useWalletBalancesForAddress(address ?? undefined);
}

export type { WalletBalance };
