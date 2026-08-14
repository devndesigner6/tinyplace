"use client";

import type { ReactNode } from "react";

import type { FunctionComponent } from "@src/common/types";
import { LocalIdentityProvider } from "@src/common/wallet-local-identity";

type WalletContextProviderProperties = {
	children: ReactNode;
};

export const WalletContextProvider = ({
	children,
}: WalletContextProviderProperties): FunctionComponent => {
	return <LocalIdentityProvider>{children}</LocalIdentityProvider>;
};
