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
		<div className="space-y-3">
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
									className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white"
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
									{t("storefront.hire", { defaultValue: "Start escrow" })}
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
						className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white"
						disabled={!agentId || createProduct.isPending}
						type="submit"
					>
						{t("storefront.publishListing", {
							defaultValue: "Publish listing",
						})}
					</button>
				</form>
			) : null}

			{activeTab === "active" ? (
				<div className="space-y-2">
					{(escrowsQuery.data?.escrows ?? []).map((escrow) => (
						<div
							key={escrow.escrowId}
							className={`rounded-lg border p-3 ${cardClass}`}
						>
							<p className="text-sm font-semibold">{escrow.escrowId}</p>
							<p className="text-xs text-muted">
								{escrow.status} · {escrow.amount} {escrow.asset}
							</p>
							{escrow.onChainTx ? (
								<p className="mt-1 truncate text-[10px] text-muted">
									{escrow.onChainTx}
								</p>
							) : null}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
};
