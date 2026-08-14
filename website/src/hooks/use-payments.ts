import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
	type UseQueryResult,
} from "@tanstack/react-query";
import {
	generateNonce,
	type Subscription,
	type SubscriptionCreateRequest,
	type SubscriptionRenewRequest,
	type SubscriptionRenewResponse,
	type SupportedChain,
	type X402SettleRequest,
	type X402SettleResponse,
	type X402VerifyRequest,
	type X402VerifyResponse,
} from "@tinyhumansai/tinyplace";

import { useApiClient } from "@src/common/api-context";
import { MIDNIGHT_SETUP_MESSAGE } from "@src/common/midnight-payment";
import { queryKeys } from "@src/common/query-keys";
import { useAuthStore } from "@src/store/auth";

function subscriptionId(): string {
	return `sub_${generateNonce().replace(/_/g, "")}`;
}

export function useSupportedPayments(): UseQueryResult<{
	chains: Array<SupportedChain>;
}> {
	const client = useApiClient();
	return useQuery({
		queryKey: queryKeys.payments.supported(),
		queryFn: (): Promise<{ chains: Array<SupportedChain> }> =>
			client.payments.supported(),
	});
}

export function useVerifyPayment(): UseMutationResult<
	X402VerifyResponse,
	Error,
	X402VerifyRequest
> {
	const client = useApiClient();
	return useMutation({
		mutationFn: (request): Promise<X402VerifyResponse> =>
			client.payments.verify(request),
	});
}

export function useSettlePayment(): UseMutationResult<
	X402SettleResponse,
	Error,
	X402SettleRequest
> {
	const client = useApiClient();
	return useMutation({
		mutationFn: (request): Promise<X402SettleResponse> =>
			client.payments.settle(request),
	});
}

export function useSubscription(
	subscriptionId: string | undefined
): UseQueryResult<Subscription> {
	const client = useApiClient();
	return useQuery({
		queryKey: queryKeys.payments.subscription(subscriptionId ?? ""),
		queryFn: (): Promise<Subscription> =>
			client.payments.getSubscription(subscriptionId ?? ""),
		enabled: Boolean(subscriptionId),
	});
}

export function useCreateSubscription(): UseMutationResult<
	Subscription,
	Error,
	SubscriptionCreateRequest
> {
	const client = useApiClient();
	const agentId = useAuthStore((state) => state.agentId);
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (request): Promise<Subscription> => {
			const nextSubscriptionId = request.subscriptionId ?? subscriptionId();
			const subscriber = request.subscriber || agentId;
			if (!subscriber) {
				throw new Error("Subscriber is required");
			}
			if (!request.authorization?.signature) {
				throw new Error(MIDNIGHT_SETUP_MESSAGE);
			}
			return client.payments.createSubscription({
				...request,
				subscriptionId: nextSubscriptionId,
				subscriber,
			});
		},
		onSuccess: (subscription): void => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.payments.subscription(subscription.subscriptionId),
			});
		},
	});
}

export function useRenewSubscription(): UseMutationResult<
	SubscriptionRenewResponse,
	Error,
	{ subscriptionId: string; request?: Partial<SubscriptionRenewRequest> }
> {
	const client = useApiClient();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			subscriptionId: id,
			request,
		}): Promise<SubscriptionRenewResponse> => {
			if (request?.paymentAuthorization) {
				return client.payments.renewSubscription(id, {
					paymentAuthorization: request.paymentAuthorization,
					settledAmount: request.settledAmount,
				});
			}
			throw new Error(MIDNIGHT_SETUP_MESSAGE);
		},
		onSuccess: ({ subscription }): void => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.payments.subscription(subscription.subscriptionId),
			});
		},
	});
}

export function useCancelSubscription(): UseMutationResult<
	void,
	Error,
	string
> {
	const client = useApiClient();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (subscriptionId): Promise<void> =>
			client.payments.cancelSubscription(subscriptionId),
		onSuccess: (_response, subscriptionIdValue): void => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.payments.subscription(subscriptionIdValue),
			});
		},
	});
}
