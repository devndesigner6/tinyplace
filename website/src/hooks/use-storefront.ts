"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Escrow, EscrowCreateRequest } from "@tinyhumansai/tinyplace";

import { useApiClient } from "@src/common/api-context";
import { queryKeys } from "@src/common/query-keys";
import { useAuthStore } from "@src/store/auth";

export function useStorefrontProducts(): ReturnType<
	typeof useQuery<
		Awaited<
			ReturnType<ReturnType<typeof useApiClient>["marketplace"]["listProducts"]>
		>
	>
> {
	const client = useApiClient();
	return useQuery({
		queryKey: ["storefront", "products"],
		queryFn: (): ReturnType<typeof client.marketplace.listProducts> =>
			client.marketplace.listProducts(),
	});
}

export function useCreateStorefrontProduct(): ReturnType<
	typeof useMutation<
		unknown,
		Error,
		{
			title: string;
			description: string;
			category?: string;
			priceAmount: string;
		}
	>
> {
	const client = useApiClient();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input): Promise<unknown> =>
			client.marketplace.createProduct(input),
		onSuccess: (): void => {
			void queryClient.invalidateQueries({ queryKey: ["storefront"] });
		},
	});
}

export function useMyEscrows(): ReturnType<
	typeof useQuery<{ escrows: Array<Escrow> }>
> {
	const client = useApiClient();
	const agentId = useAuthStore((state) => state.agentId);
	return useQuery({
		queryKey: queryKeys.escrow.list({ client: agentId }),
		queryFn: (): Promise<{ escrows: Array<Escrow> }> =>
			client.escrow.list({ client: agentId }),
		enabled: Boolean(agentId),
	});
}

export function useCreateJobFromProduct(): ReturnType<
	typeof useMutation<
		Awaited<
			ReturnType<ReturnType<typeof useApiClient>["marketplace"]["createJob"]>
		>,
		Error,
		{ productId: string }
	>
> {
	const client = useApiClient();
	return useMutation({
		mutationFn: ({
			productId,
		}): ReturnType<typeof client.marketplace.createJob> =>
			client.marketplace.createJob(productId),
	});
}

export function useCreateEscrowFromJob(): ReturnType<
	typeof useMutation<Escrow, Error, EscrowCreateRequest>
> {
	const client = useApiClient();
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (request: EscrowCreateRequest): Promise<Escrow> =>
			client.escrow.create(request),
		onSuccess: (): void => {
			void queryClient.invalidateQueries({ queryKey: ["escrow"] });
		},
	});
}
