"use client";

import { useQuery } from "@tanstack/react-query";

const API_BASE_URL =
	(process.env as Record<string, string | undefined>)["NEXT_PUBLIC_API_BASE_URL"] ||
	"https://tinyplace-backend.onrender.com";

export type BackendHealth = {
	status: string;
	settlement: string;
	midnightNetwork: string;
	contractsReady?: boolean;
	hackathonDevMode?: boolean;
	hackathonDevFallback?: boolean;
	contracts?: {
		handleRegistry?: string;
		listingRegistry?: string;
		escrow?: string;
		attestation?: string;
	};
};

export function useBackendHealth(): {
	data: BackendHealth | undefined;
	isLoading: boolean;
	isError: boolean;
} {
	const query = useQuery({
		queryKey: ["backend", "healthz"],
		queryFn: async (): Promise<BackendHealth> => {
			const response = await fetch(`${API_BASE_URL}/healthz`);
			if (!response.ok) {
				throw new Error(`healthz ${response.status}`);
			}
			return (await response.json()) as BackendHealth;
		},
		refetchInterval: 30_000,
		retry: 1,
	});

	return {
		data: query.data,
		isLoading: query.isLoading,
		isError: query.isError,
	};
}
