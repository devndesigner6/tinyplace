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

	const connect = useCallback(async (): Promise<void> => {
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
		useAuthStore.getState().clearSession();
		setAddress(null);
		setReady(true);
		return Promise.resolve();
	}, []);

	useEffect(() => {
		let isMounted = true;
		const init = async (): Promise<void> => {
			const stored = loadOrCreateStoredIdentity();
			const signer = await LocalSigner.fromSeed(
				base64ToBytes(stored.seedBase64),
				{ siws: false }
			);
			if (!isMounted) return;
			setAuthSession(signer);
			setAddress(signer.agentId);
			setReady(true);
		};
		void init();
		return (): void => {
			isMounted = false;
		};
	}, []);

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
				void connect();
			},
			address,
			signMessage,
		}),
		[address, connect, disconnect, ready, signMessage]
	);

	return (
		<WalletStateContext.Provider value={value}>
			{children}
		</WalletStateContext.Provider>
	);
}
