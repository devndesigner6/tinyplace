"use client";

import { useTranslation } from "react-i18next";

import type { FunctionComponent } from "@src/common/types";
import { useBackendHealth } from "@src/hooks/use-backend-health";
import { useAuthStore } from "@src/store/auth";
import { useTinyplaceWallet } from "@src/common/tinyplace-wallet";

type MidnightWalletProperties = {
	isDark: boolean;
};

export const MidnightWallet = ({
	isDark,
}: MidnightWalletProperties): FunctionComponent => {
	const { t } = useTranslation();
	const agentId = useAuthStore((state) => state.agentId);
	const wallet = useTinyplaceWallet();
	const address = wallet.address ?? agentId;
	const health = useBackendHealth();

	const cardClass = isDark
		? "border-neutral-800 bg-neutral-950 text-white"
		: "border-neutral-200 bg-white text-black";
	const mutedClass = isDark ? "text-neutral-400" : "text-neutral-500";
	const codeClass = isDark
		? "bg-neutral-900 text-emerald-400"
		: "bg-neutral-100 text-emerald-700";

	const network = process.env["NEXT_PUBLIC_MIDNIGHT_NETWORK"] ?? "undeployed";

	return (
		<div className="mx-auto w-full max-w-2xl space-y-4">
			<div className={`rounded-lg border p-5 ${cardClass}`}>
				<h2 className="text-lg font-semibold">
					{t("midnightWallet.title", { defaultValue: "Midnight wallet" })}
				</h2>
				<p className={`mt-2 text-sm ${mutedClass}`}>
					{t("midnightWallet.subtitle", {
						defaultValue:
							"tiny.place settles on Midnight. Your browser identity is a local Ed25519 key — fund the local genesis wallet for contract calls.",
					})}
				</p>

				{address ? (
					<div className="mt-4">
						<p className={`text-xs font-medium ${mutedClass}`}>
							{t("midnightWallet.yourAddress", {
								defaultValue: "Your identity (cryptoId)",
							})}
						</p>
						<p
							className={`mt-1 break-all rounded-md px-3 py-2 font-mono text-xs ${codeClass}`}
						>
							{address}
						</p>
					</div>
				) : (
					<p className={`mt-4 text-sm ${mutedClass}`}>
						{t("midnightWallet.connectHint", {
							defaultValue: "Connect using the wallet button in the header.",
						})}
					</p>
				)}

				<p className={`mt-2 text-xs ${mutedClass}`}>
					{t("midnightWallet.network", {
						defaultValue: "Network",
					})}
					:{" "}
					<span className="font-mono">
						{health.data?.midnightNetwork ?? `midnight:${network}`}
					</span>
				</p>
				{health.data && (
					<p className={`mt-2 text-xs ${mutedClass}`}>
						Contracts:{" "}
						{health.data.contractsReady
							? "deployed"
							: health.data.hackathonDevFallback
								? "dev fallback (off-chain demo)"
								: "contract source included (Preprod deployment pending)"}
					</p>
				)}
			</div>

			<div className={`rounded-lg border p-5 ${cardClass}`}>
				<h3 className="text-sm font-semibold">
					{t("midnightWallet.localStack", {
						defaultValue: "Run the local Midnight stack",
					})}
				</h3>
				<pre
					className={`mt-3 overflow-x-auto rounded-md p-3 font-mono text-xs ${codeClass}`}
				>
					{`pnpm midnight:up
pnpm midnight:compile
pnpm midnight:deploy
pnpm --filter @tinyplace/backend dev`}
				</pre>
				<p className={`mt-3 text-xs ${mutedClass}`}>
					{t("midnightWallet.dockerHint", {
						defaultValue:
							"Requires Docker Desktop. Contracts deploy to localhost:9944 with the proof server on :6300.",
					})}
				</p>
			</div>
		</div>
	);
};
