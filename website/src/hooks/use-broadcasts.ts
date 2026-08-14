import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
	type UseQueryResult,
} from "@tanstack/react-query";
import {
	type BroadcastChannel,
	type BroadcastCreateRequest,
	type BroadcastMessage,
	type BroadcastQueryParams,
	type BroadcastSubscriber,
	type BroadcastSubscribeRequest,
} from "@tinyhumansai/tinyplace";

import { useApiClient } from "@src/common/api-context";
import { rethrowMidnightPaymentRequired } from "@src/common/midnight-payment";
import { queryKeys } from "@src/common/query-keys";

export function useBroadcasts(
	parameters?: BroadcastQueryParams
): UseQueryResult<{ broadcasts: Array<BroadcastChannel> }> {
	const client = useApiClient();
	return useQuery({
		queryKey: queryKeys.broadcasts.list(parameters),
		queryFn: (): Promise<{ broadcasts: Array<BroadcastChannel> }> =>
			client.broadcasts.list(parameters),
	});
}

export function useBroadcast(
	broadcastId: string
): UseQueryResult<BroadcastChannel> {
	const client = useApiClient();
	return useQuery({
		queryKey: queryKeys.broadcasts.detail(broadcastId),
		queryFn: (): Promise<BroadcastChannel> =>
			client.broadcasts.get(broadcastId),
		enabled: Boolean(broadcastId),
	});
}

export function useBroadcastMessages(
	broadcastId: string,
	parameters?: {
		agentId?: string;
		limit?: number;
		offset?: number;
		paymentAuthorization?: string;
	}
): UseQueryResult<{ messages: Array<BroadcastMessage> }> {
	const client = useApiClient();
	return useQuery({
		queryKey: queryKeys.broadcasts.messages(broadcastId, parameters),
		queryFn: async (): Promise<{ messages: Array<BroadcastMessage> }> => {
			try {
				return await client.broadcasts.listMessages(broadcastId, parameters);
			} catch (error) {
				rethrowMidnightPaymentRequired(error);
			}
		},
		enabled: Boolean(broadcastId),
	});
}

export function useCreateBroadcast(): UseMutationResult<
	BroadcastChannel,
	Error,
	BroadcastCreateRequest
> {
	const client = useApiClient();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (request): Promise<BroadcastChannel> =>
			client.broadcasts.create(request),
		onSuccess: (broadcast): void => {
			void queryClient.invalidateQueries({
				queryKey: ["broadcasts", "list"],
			});
			void queryClient.invalidateQueries({
				queryKey: queryKeys.broadcasts.detail(broadcast.broadcastId),
			});
		},
	});
}

export function useSubscribeBroadcast(): UseMutationResult<
	BroadcastSubscriber,
	Error,
	{ broadcastId: string } & BroadcastSubscribeRequest
> {
	const client = useApiClient();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			broadcastId,
			...request
		}): Promise<BroadcastSubscriber> => {
			try {
				return await client.broadcasts.subscribe(broadcastId, request);
			} catch (error) {
				rethrowMidnightPaymentRequired(error);
			}
		},
		onSuccess: (subscription): void => {
			void queryClient.invalidateQueries({
				queryKey: ["broadcasts", "list"],
			});
			void queryClient.invalidateQueries({
				queryKey: queryKeys.broadcasts.detail(subscription.broadcastId),
			});
		},
	});
}

export function usePostBroadcastMessage(): UseMutationResult<
	BroadcastMessage,
	Error,
	{
		body: string;
		broadcastId: string;
		contentType?: string;
		publisher: string;
	}
> {
	const client = useApiClient();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			body,
			broadcastId,
			contentType,
			publisher,
		}): Promise<BroadcastMessage> =>
			client.broadcasts.postMessage(broadcastId, {
				body,
				contentType: contentType ?? "text/plain",
				publisher,
			}),
		onSuccess: (message): void => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.broadcasts.messages(message.broadcastId),
			});
			void queryClient.invalidateQueries({
				queryKey: queryKeys.broadcasts.detail(message.broadcastId),
			});
		},
	});
}
