import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
	type UseQueryResult,
} from "@tanstack/react-query";
import {
	TinyPlaceError,
	type AvailabilityResponse,
	type Identity,
	type IdentityClaimRequest,
	type RenewalRequest,
} from "@tinyhumansai/tinyplace";

import { useApiClient } from "@src/common/api-context";
import { MIDNIGHT_SETUP_MESSAGE } from "@src/common/midnight-payment";
import { queryKeys } from "@src/common/query-keys";
import { useAuthStore } from "@src/store/auth";

/** Minimum handle length the registry accepts (backend rule `{1,64}`). */
export const MIN_HANDLE_LENGTH = 1;

function rethrowPaymentRequired(error: unknown): never {
	if (error instanceof TinyPlaceError && error.status === 402) {
		throw new Error(MIDNIGHT_SETUP_MESSAGE);
	}
	throw error;
}

export function useHandleAvailability(
	name: string
): UseQueryResult<AvailabilityResponse> {
	const client = useApiClient();
	const normalized = name.trim().replace(/^@+/, "");
	return useQuery({
		queryKey: queryKeys.registry.availability(normalized),
		queryFn: (): Promise<AvailabilityResponse> =>
			client.registry.get(normalized),
		enabled: normalized.length >= MIN_HANDLE_LENGTH,
	});
}

export function useRenewIdentity(): UseMutationResult<
	Identity,
	Error,
	{ name: string; request?: RenewalRequest }
> {
	const client = useApiClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ name, request }): Promise<Identity> => {
			const normalized = name.trim().replace(/^@+/, "");
			if (!normalized) {
				throw new Error("Identity name is required");
			}
			const handle = `@${normalized}`;
			try {
				return await client.registry.renew(handle, request ?? {});
			} catch (error) {
				rethrowPaymentRequired(error);
			}
		},
		onSuccess: (identity): void => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.registry.availability(
					identity.username.trim().replace(/^@+/, "")
				),
			});
		},
	});
}

export function useSetPrimaryIdentity(): UseMutationResult<
	Identity,
	Error,
	{ name: string; primary: boolean }
> {
	const client = useApiClient();
	const agentId = useAuthStore((state) => state.agentId);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ name, primary }): Promise<Identity> => {
			const normalized = name.trim().replace(/^@+/, "");
			if (!normalized) {
				throw new Error("Identity name is required");
			}
			const handle = `@${normalized}`;
			return primary
				? client.registry.assignPrimary(handle)
				: client.registry.unassignPrimary(handle);
		},
		onSuccess: (identity): void => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.registry.availability(
					identity.username.trim().replace(/^@+/, "")
				),
			});
			if (agentId) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.directory.reverse(agentId),
				});
			}
			void queryClient.invalidateQueries({
				queryKey: queryKeys.directory.identities(),
			});
		},
	});
}

export function useTransferIdentity(): UseMutationResult<
	Identity,
	Error,
	{ cryptoId: string; name: string; publicKey: string }
> {
	const client = useApiClient();
	const agentId = useAuthStore((state) => state.agentId);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ cryptoId, name, publicKey }): Promise<Identity> => {
			const normalized = name.trim().replace(/^@+/, "");
			if (!normalized) {
				throw new Error("Identity name is required");
			}
			if (!cryptoId || !publicKey) {
				throw new Error("Recipient wallet is required");
			}
			return client.registry.transfer(`@${normalized}`, {
				cryptoId,
				publicKey,
			});
		},
		onSuccess: (identity): void => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.registry.availability(
					identity.username.trim().replace(/^@+/, "")
				),
			});
			if (agentId) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.directory.reverse(agentId),
				});
			}
			void queryClient.invalidateQueries({
				queryKey: queryKeys.directory.identities(),
			});
		},
	});
}

export function useClaimIdentity(): UseMutationResult<
	Identity,
	Error,
	{ name: string; request?: Partial<IdentityClaimRequest> }
> {
	const client = useApiClient();
	const signer = useAuthStore((state) => state.signer);
	const agentId = useAuthStore((state) => state.agentId);
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ name, request }): Promise<Identity> => {
			const normalized = name.trim().replace(/^@+/, "");
			if (!normalized) {
				throw new Error("Identity name is required");
			}
			if (!signer || !agentId) {
				throw new Error("Connect your wallet first");
			}

			const handle = `@${normalized}`;
			const claimRequest: IdentityClaimRequest = {
				cryptoId: request?.cryptoId ?? agentId,
				publicKey: request?.publicKey ?? signer.publicKeyBase64,
				...(request?.payment ? { payment: request.payment } : {}),
				...(request?.signature ? { signature: request.signature } : {}),
			};

			try {
				return await client.registry.claim(handle, claimRequest);
			} catch (error) {
				rethrowPaymentRequired(error);
			}
		},
		onSuccess: (identity): void => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.registry.availability(
					identity.username.trim().replace(/^@+/, "")
				),
			});
			void queryClient.invalidateQueries({
				queryKey: queryKeys.directory.identities(),
			});
		},
	});
}
