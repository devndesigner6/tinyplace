import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Identity, ReverseResponse } from "@tinyhumansai/tinyplace";

import { useApiClient } from "@src/common/api-context";
import { queryKeys } from "@src/common/query-keys";

export function useOwnedIdentities(
	agentId: string | undefined
): UseQueryResult<ReverseResponse> {
	const client = useApiClient();
	return useQuery({
		queryKey: queryKeys.directory.reverse(agentId ?? ""),
		queryFn: (): Promise<ReverseResponse> =>
			client.directory.reverse(agentId as string),
		enabled: Boolean(agentId),
	});
}

export function firstActiveIdentity(
	identities: Array<Identity> | undefined
): Identity | undefined {
	return identities?.find((identity) => identity.status === "active");
}
