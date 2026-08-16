"use client";

import { useBackendHealth } from "@src/hooks/use-backend-health";

export function MidnightNetworkBadge(): React.ReactElement {
	const { data, isError, isLoading } = useBackendHealth();

	if (isLoading) {
		return (
			<span className="rounded-md border border-neutral-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
				midnight · …
			</span>
		);
	}

	if (isError || !data) {
		return (
			<span
				className="rounded-md border border-rose-800 bg-rose-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-400"
				title="Backend offline — start pnpm dev:backend"
			>
				api offline
			</span>
		);
	}

	const ready = data.contractsReady === true;
	const developmentFallback = data.hackathonDevFallback === true;
	const tone = ready
		? "border-emerald-800 bg-emerald-950/40 text-emerald-400"
		: developmentFallback
			? "border-amber-800 bg-amber-950/40 text-amber-400"
			: "border-amber-800 bg-amber-950/40 text-amber-400";
	const label = ready
		? "chain ready"
		: developmentFallback
			? "dev fallback"
			: "contract source ready";

	return (
		<span
			className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
			title={`${data.settlement} · ${data.midnightNetwork} · ${label}${ready ? "" : " · Preprod deployment pending"}`}
		>
			{data.settlement} · {label}
		</span>
	);
}
