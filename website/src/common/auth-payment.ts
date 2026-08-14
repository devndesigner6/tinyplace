import type { Signer, TinyPlaceClient } from "@tinyhumansai/tinyplace";

import { createClient } from "@src/common/api-client";
import { useAuthStore } from "@src/store/auth";

export type AuthSession = {
	agentId: string;
	identitySigner: Signer;
	signer: Signer;
};

export function currentAuthSession(): AuthSession | undefined {
	const { agentId, identitySigner, signer } = useAuthStore.getState();
	if (!agentId || !signer || !identitySigner) {
		return undefined;
	}
	return { agentId, identitySigner, signer };
}

export function requireAuthSession(): AuthSession {
	const session = currentAuthSession();
	if (!session) {
		throw new Error("Connect your wallet first");
	}
	return session;
}

export function setAuthSession(signer: Signer, identity?: Signer): void {
	useAuthStore.getState().setSigner(signer, signer.agentId, identity);
}

export function createAuthenticatedClient(
	signer?: Signer,
	onAuthInvalid?: (status: number, body: unknown) => void
): TinyPlaceClient {
	return createClient(signer ?? currentAuthSession()?.signer, onAuthInvalid);
}

export function createIdentityClient(): TinyPlaceClient {
	return createClient(currentAuthSession()?.identitySigner);
}

export function identitySigner(): Signer | undefined {
	return currentAuthSession()?.identitySigner;
}

export function sessionSigner(): Signer | undefined {
	return currentAuthSession()?.signer;
}
