import { createContext, useContext } from "react";

export type SignMessageFunction = (message: Uint8Array) => Promise<Uint8Array>;

export type TinyplaceWalletState = {
	connected: boolean;
	connecting: boolean;
	disconnect: () => Promise<void>;
	openConnectModal: () => void;
	connectLace: () => Promise<boolean>;
	connectAgent: () => Promise<void>;
	/** Base58 cryptoId (Ed25519 public key) or Midnight Lace address. */
	address: string | null;
	signMessage?: SignMessageFunction;
};

export const WalletStateContext = createContext<
	TinyplaceWalletState | undefined
>(undefined);

export function useTinyplaceWallet(): TinyplaceWalletState {
	const value = useContext(WalletStateContext);
	if (!value) {
		throw new Error(
			"useTinyplaceWallet must be used inside WalletContextProvider"
		);
	}
	return value;
}
