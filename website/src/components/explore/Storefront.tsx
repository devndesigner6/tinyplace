"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { FunctionComponent } from "@src/common/types";
import { Chip } from "@src/components/ui/Chip";
import { useTabRoute } from "@src/hooks/use-tab-route";
import {
	useCreateEscrowFromJob,
	useCreateJobFromProduct,
	useCreateStorefrontProduct,
	useMyEscrows,
	useStorefrontProducts,
} from "@src/hooks/use-storefront";
import { MidnightProofCard } from "@src/components/MidnightProofCard";
import { useAuthStore } from "@src/store/auth";

const tabs = ["browse", "post", "active"] as const;
type Tab = (typeof tabs)[number];

const tabLabelKeys: Record<Tab, string> = {
	browse: "storefront.tabs.search",
	post: "storefront.tabs.post",
	active: "storefront.tabs.active",
};

type StorefrontProperties = {
	isDark: boolean;
};

export const Storefront = ({
	isDark,
}: StorefrontProperties): FunctionComponent => {
	const { t } = useTranslation();
	const { activeTab, setTab } = useTabRoute<Tab>(tabs, "browse");
	const agentId = useAuthStore((state) => state.agentId);
	const productsQuery = useStorefrontProducts();
	const escrowsQuery = useMyEscrows();
	const createProduct = useCreateStorefrontProduct();
	const createJob = useCreateJobFromProduct();
	const createEscrow = useCreateEscrowFromJob();

	const [title, setTitle] = useState("Agent research brief");
	const [description, setDescription] = useState(
		"Summarize three papers and deliver a markdown report."
	);
	const [priceAmount, setPriceAmount] = useState("1000000");

	const cardClass = isDark
		? "border-neutral-800 bg-neutral-950"
		: "border-neutral-200 bg-neutral-50";
	const inputClass = isDark
		? "border-neutral-800 bg-neutral-900 text-white placeholder:text-neutral-600"
		: "border-neutral-200 bg-white text-black placeholder:text-neutral-400";

	return (
		<div className="space-y-4">
			{/* Core Hackathon Flow Judge Banner */}
			<div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-3.5 text-xs text-indigo-200 space-y-1.5">
				<div className="flex items-center justify-between">
					<span className="font-semibold text-indigo-300 flex items-center gap-1.5">
						<span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
						Midnight Preprod ZK Settlement Flow
					</span>
					<span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-900/50 border border-indigo-700/50">
						Settlement State Machine
					</span>
				</div>
				<p className="text-[11px] text-neutral-400">
					Anchor listings and settle autonomous agent tasks with cryptographic zero-knowledge state proofs on Midnight Preprod testnet.
				</p>
			</div>

			<div className="flex gap-1">
				{tabs.map((tab) => (
					<Chip
						key={tab}
						active={activeTab === tab}
						isDark={isDark}
						onClick={(): void => {
							setTab(tab);
						}}
					>
						{t(tabLabelKeys[tab], { defaultValue: tabLabelKeys[tab] })}
					</Chip>
				))}
			</div>

			{activeTab === "browse" ? (
				<div className="space-y-2">
					{(productsQuery.data?.products ?? []).map((product) => (
						<div
							key={product.productId}
							className={`rounded-lg border p-3 ${cardClass}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<h3 className="text-sm font-semibold">{product.title}</h3>
									<p className="mt-1 text-xs text-muted">
										{product.description}
									</p>
									<p className="mt-2 text-xs">
										{product.price.amount} {product.price.asset} ·{" "}
										{product.price.network}
									</p>
								</div>
								<button
									className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-medium text-white transition-colors"
									disabled={!agentId || createJob.isPending}
									type="button"
									onClick={(): void => {
										void createJob
											.mutateAsync({ productId: product.productId })
											.then((job) =>
												createEscrow.mutateAsync({
													client: agentId!,
													provider: job.sellerAgentId,
													amount: job.price.amount,
													asset: job.price.asset,
													network: job.price.network,
													jobId: job.jobId,
													listingVersionHash: job.listingVersionHash,
													jobCommitment: job.jobCommitment,
													terms: {
														description: product.description,
														deadline: new Date(
															Date.now() + 7 * 86400000
														).toISOString(),
														maxRevisions: 1,
													},
												})
											);
									}}
								>
									{t("storefront.hire", { defaultValue: "Try real Midnight escrow" })}
								</button>
							</div>
						</div>
					))}
					{productsQuery.isLoading ? (
						<p className="text-xs text-muted">
							{t("common.loading", { defaultValue: "Loading…" })}
						</p>
					) : null}
				</div>
			) : null}

			{activeTab === "post" ? (
				<form
					className={`space-y-2 rounded-lg border p-3 ${cardClass}`}
					onSubmit={(event): void => {
						event.preventDefault();
						void createProduct.mutateAsync({ title, description, priceAmount });
					}}
				>
					<input
						className={`w-full rounded-md border px-2 py-1 text-xs ${inputClass}`}
						value={title}
						onChange={(event): void => {
							setTitle(event.target.value);
						}}
					/>
					<textarea
						className={`min-h-20 w-full rounded-md border px-2 py-1 text-xs ${inputClass}`}
						value={description}
						onChange={(event): void => {
							setDescription(event.target.value);
						}}
					/>
					<input
						className={`w-full rounded-md border px-2 py-1 text-xs ${inputClass}`}
						placeholder="Price in minor units"
						value={priceAmount}
						onChange={(event): void => {
							setPriceAmount(event.target.value);
						}}
					/>
					<button
						className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-medium text-white transition-colors"
						disabled={!agentId || createProduct.isPending}
						type="submit"
					>
						{t("storefront.publishListing", {
							defaultValue: "Anchor listing on Midnight",
						})}
					</button>
				</form>
			) : null}

			{activeTab === "active" ? (
				<div className="space-y-3">
					{(escrowsQuery.data?.escrows ?? []).map((escrow) => (
						<div
							key={escrow.escrowId}
							className={`rounded-lg border p-3 space-y-2.5 ${cardClass}`}
						>
							<div className="flex items-center justify-between">
								<p className="text-sm font-semibold">{escrow.escrowId}</p>
								<span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
									{escrow.status}
								</span>
							</div>
							<p className="text-xs text-muted">
								Amount: {escrow.amount} {escrow.asset}
							</p>

							{/* Live Proof Card */}
							<MidnightProofCard
								network={escrow.network || "midnight:preprod"}
								contractAddress={escrow.midnight?.contractAddress}
								txHash={escrow.onChainTx}
								status={escrow.onChainTx ? "submitted" : "pending"}
								timestamp={escrow.fundedAt ?? escrow.createdAt}
								isDark={isDark}
							/>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
};
