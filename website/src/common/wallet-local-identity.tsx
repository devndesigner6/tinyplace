"use client";

import { LocalSigner } from "@tinyhumansai/tinyplace";
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

import { setAuthSession } from "@src/common/auth-payment";
import type { FunctionComponent } from "@src/common/types";
import {
	WalletStateContext,
	type SignMessageFunction,
	type TinyplaceWalletState,
} from "@src/common/tinyplace-wallet";
import { useAuthStore } from "@src/store/auth";

const STORAGE_KEY = "tinyplace.localIdentity.v1";

type StoredIdentity = {
	seedBase64: string;
	label: string;
};

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function loadOrCreateStoredIdentity(): StoredIdentity {
	if (typeof window === "undefined") {
		const seed = crypto.getRandomValues(new Uint8Array(32));
		return { seedBase64: bytesToBase64(seed), label: "agent" };
	}
	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (raw) {
		return JSON.parse(raw) as StoredIdentity;
	}
	const seed = crypto.getRandomValues(new Uint8Array(32));
	const stored = { seedBase64: bytesToBase64(seed), label: "agent" };
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
	return stored;
}

export function LocalIdentityProvider({
	children,
}: {
	children: ReactNode;
}): FunctionComponent {
	const [ready, setReady] = useState(false);
	const [address, setAddress] = useState<string | null>(null);
	const agentId = useAuthStore((state) => state.agentId);

	const connectLace = useCallback(async (): Promise<boolean> => {
		if (typeof window === "undefined") return false;
		const win = window as any;

		// 1. Official Midnight Lace DApp Connector API (window.midnight.mnLace)
		const midnightProvider = win.midnight?.mnLace || win.midnight?.lace;
		if (midnightProvider && typeof midnightProvider.enable === "function") {
			try {
				const walletApi = await midnightProvider.enable();
				const state = typeof walletApi?.state === "function" ? await walletApi.state() : walletApi;
				const laceAddr = state?.shielded?.address || state?.unshielded?.address || state?.address;
				if (laceAddr) {
					const addrStr = String(laceAddr);
					const stored = loadOrCreateStoredIdentity();
					const signer = await LocalSigner.fromSeed(base64ToBytes(stored.seedBase64), { siws: false });
					useAuthStore.getState().setSigner(signer, addrStr);
					setAddress(addrStr);
					setReady(true);
					return true;
				}
			} catch (err: any) {
				console.error("Midnight Lace connection error:", err);
				alert(`Midnight Lace Wallet connection rejected or prompt failed: ${err?.message || err}`);
				return false;
			}
		}

		// 2. Cardano CIP-30 Provider (window.cardano.lace)
		const cardanoProvider = win.cardano?.lace || win.cardano?.mnLace;
		if (cardanoProvider && typeof cardanoProvider.enable === "function") {
			try {
				const laceApi = await cardanoProvider.enable();
				const state = typeof laceApi?.state === "function" ? await laceApi.state().catch(() => null) : laceApi;
				let laceAddr: string | null = state?.shielded?.address || state?.unshielded?.address || state?.address || null;

				if (!laceAddr && typeof laceApi?.getUsedAddresses === "function") {
					try {
						const addrs = await laceApi.getUsedAddresses();
						if (addrs && addrs.length > 0) laceAddr = addrs[0];
					} catch {
						// Ignore channel closed warnings
					}
				}

				if (!laceAddr && typeof laceApi?.getChangeAddress === "function") {
					try {
						laceAddr = await laceApi.getChangeAddress();
					} catch {
						// Ignore channel closed warnings
					}
				}

				if (laceAddr) {
					const addrStr = String(laceAddr);
					const stored = loadOrCreateStoredIdentity();
					const signer = await LocalSigner.fromSeed(base64ToBytes(stored.seedBase64), { siws: false });
					useAuthStore.getState().setSigner(signer, addrStr);
					setAddress(addrStr);
					setReady(true);
					return true;
				}
			} catch (err: any) {
				console.error("Cardano Lace connection error:", err);
				if (!err?.message?.includes("shutdown") && !err?.message?.includes("closed")) {
					alert(`Cardano Lace Wallet connection rejected or prompt failed: ${err?.message || err}`);
				}
				return false;
			}
		}

		alert("Lace Wallet extension (window.midnight.mnLace or window.cardano.lace) was not detected in your browser window context. Please make sure the extension is enabled.");
		return false;
	}, []);

	const connectAgent = useCallback(async (): Promise<void> => {
		const stored = loadOrCreateStoredIdentity();
		const signer = await LocalSigner.fromSeed(
			base64ToBytes(stored.seedBase64),
			{
				siws: false,
			}
		);
		setAuthSession(signer);
		setAddress(signer.agentId);
		setReady(true);
	}, []);

	const disconnect = useCallback((): Promise<void> => {
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(STORAGE_KEY);
		}
		useAuthStore.getState().clearSession();
		setAddress(null);
		setReady(true);
		return Promise.resolve();
	}, []);

	useEffect(() => {
		if (typeof window !== "undefined") {
			const raw = window.localStorage.getItem(STORAGE_KEY);
			if (raw) {
				void connectAgent();
				return;
			}
		}
		setAddress(null);
		setReady(true);
	}, [connectAgent]);

	const signMessage = useMemo<SignMessageFunction | undefined>(() => {
		if (!agentId) return undefined;
		const signer = useAuthStore.getState().signer;
		if (!signer) return undefined;
		return async (message: Uint8Array): Promise<Uint8Array> =>
			signer.sign(message);
	}, [agentId]);

	const value = useMemo<TinyplaceWalletState>(
		() => ({
			connected: Boolean(address),
			connecting: !ready,
			disconnect,
			openConnectModal: (): void => {
				void connectAgent();
			},
			connectLace,
			connectAgent,
			address,
			signMessage,
		}),
		[address, connectAgent, connectLace, disconnect, ready, signMessage]
	);

	return (
		<WalletStateContext.Provider value={value}>
			{children}
		</WalletStateContext.Provider>
	);
}
