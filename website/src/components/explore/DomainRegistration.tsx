"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { TinyPlaceError } from "@tinyhumansai/tinyplace";
import { apiErrorMessage } from "@src/common/api-error";
import type { FunctionComponent } from "@src/common/types";
import {
	formatFee,
	getAnnualFee,
	PRICING_TIERS,
} from "@src/components/explore/domain-pricing";
import { sanitizeHandle } from "@src/components/explore/identity-management";
import { createClient } from "@src/common/api-client";
import { MIDNIGHT_SETUP_MESSAGE } from "@src/common/midnight-payment";
import { queryKeys } from "@src/common/query-keys";
import {
	MIN_HANDLE_LENGTH,
	useHandleAvailability,
} from "@src/hooks/use-registry";
import { useOwnedIdentities } from "@src/hooks/use-marketplace";
import { useAuthStore } from "@src/store/auth";

function normalizedHandle(value: string): string {
	const normalized = value.trim().replace(/^@+/, "");
	return normalized ? `@${normalized}` : "";
}

type DomainRegistrationProperties = {
	isDark: boolean;
};

export const DomainRegistration = ({
	isDark,
}: DomainRegistrationProperties): FunctionComponent => {
	const { t } = useTranslation();
	const signer = useAuthStore((state) => state.signer);
	const agentId = useAuthStore((state) => state.agentId);
	const client = useMemo(() => createClient(signer), [signer]);
	const queryClient = useQueryClient();

	const [searchInput, setSearchInput] = useState("");
	const [selectedName, setSelectedName] = useState<string | null>(null);
	const [primaryChoice, setPrimaryChoice] = useState<boolean | null>(null);
	const [registrationComplete, setRegistrationComplete] = useState(false);
	const [registrationResult, setRegistrationResult] = useState<{
		devMode?: boolean;
		note?: string;
		registrationTx?: string | null;
	} | null>(null);

	const searchName = normalizedHandle(searchInput);
	const normalizedNameLength = searchName.replace(/^@/, "").length;
	const availabilityQuery = useHandleAvailability(searchName);

	const ownedIdentities = useOwnedIdentities(agentId);
	const hasExistingPrimary = Boolean(
		ownedIdentities.data?.identities?.some((identity) => identity.primary)
	);
	const primary = primaryChoice ?? !hasExistingPrimary;

	const registerMutation = useMutation({
		mutationFn: async (): Promise<unknown> => {
			if (!selectedName || !agentId || !signer) {
				throw new Error(t("domainRegistration.connectWalletFirst"));
			}

			const request = {
				username: selectedName,
				cryptoId: agentId,
				primary,
				actorType: "human" as const,
			};

			try {
				return await client.registry.register(request);
			} catch (error) {
				if (error instanceof TinyPlaceError && error.status === 402) {
					throw new Error(MIDNIGHT_SETUP_MESSAGE);
				}
				throw error;
			}
		},
		onSuccess: (result) => {
			const body = result as {
				devMode?: boolean;
				note?: string;
				registrationTx?: string | null;
			};
			setRegistrationResult({
				devMode: body.devMode,
				note: body.note,
				registrationTx: body.registrationTx ?? null,
			});
			setRegistrationComplete(true);
			void queryClient.invalidateQueries({
				queryKey: queryKeys.directory.identities(),
			});
			if (agentId) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.directory.reverse(agentId),
				});
			}
			if (selectedName) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.registry.availability(
						selectedName.trim().replace(/^@+/, "")
					),
				});
			}
		},
	});

	const handleSearch = useCallback((): void => {
		if (availabilityQuery.data?.available) {
			setSelectedName(availabilityQuery.data.name);
		}
	}, [availabilityQuery.data]);

	const cardClass = "theme-surface-card";
	const inputClass = "theme-input";
	const headingClass = isDark ? "text-white" : "text-black";
	const secondaryClass = isDark ? "text-neutral-400" : "text-neutral-500";
	const buttonClass = "theme-primary-action";
	const disabledButtonClass = "theme-disabled-action";

	if (registrationComplete) {
		return (
			<div className={`rounded-lg border p-6 text-center ${cardClass}`}>
				<div className="mb-3 text-2xl">&#10003;</div>
				<h3 className={`text-lg font-semibold ${headingClass}`}>
					{t("domainRegistration.registeredTitle")}
				</h3>
				<p className={`mt-2 text-sm ${secondaryClass}`}>
					<span className="font-mono font-medium">{selectedName}</span>{" "}
					{t("domainRegistration.registeredDescription")}
				</p>
				{registrationResult?.registrationTx && (
					<p className={`mt-3 break-all font-mono text-xs text-emerald-500`}>
						tx: {registrationResult.registrationTx}
					</p>
				)}
				{registrationResult?.devMode && (
					<p className={`mt-2 text-xs text-amber-500`}>
						{registrationResult.note ??
							"Hackathon dev mode — deploy Midnight contracts for on-chain proof."}
					</p>
				)}
				<button
					className={`mt-4 rounded-md px-4 py-2 text-sm font-medium transition-colors ${buttonClass}`}
					type="button"
					onClick={(): void => {
						setRegistrationComplete(false);
						setRegistrationResult(null);
						setSelectedName(null);
						setSearchInput("");
						setPrimaryChoice(null);
					}}
				>
					{t("domainRegistration.registerAnother")}
				</button>
			</div>
		);
	}

	if (selectedName) {
		return (
			<div className="space-y-4">
				<div className={`rounded-lg border p-4 ${cardClass}`}>
					<div className="flex items-center justify-between">
						<div>
							<h3 className={`text-sm font-semibold ${headingClass}`}>
								{t("domainRegistration.registerName", { name: selectedName })}
							</h3>
							<p className={`mt-0.5 text-xs ${secondaryClass}`}>
								{t("domainRegistration.annualFee", {
									fee: formatFee(getAnnualFee(selectedName)),
								})}
							</p>
						</div>
						<button
							className={`text-xs ${secondaryClass} hover:underline`}
							type="button"
							onClick={(): void => {
								setSelectedName(null);
							}}
						>
							{t("domainRegistration.change")}
						</button>
					</div>
				</div>

				<div className={`rounded-lg border p-4 ${cardClass}`}>
					<label
						className={`flex items-center gap-2 text-xs font-medium ${headingClass}`}
					>
						<input
							checked={primary}
							type="checkbox"
							onChange={(event): void => {
								setPrimaryChoice(event.target.checked);
							}}
						/>
						{t("domainRegistration.setAsPrimary")}
						<span className={secondaryClass}>
							{hasExistingPrimary
								? t("domainRegistration.primaryReplacesHint")
								: t("domainRegistration.primaryDisplayHint")}
						</span>
					</label>
				</div>

				{!signer && (
					<p className={`text-xs ${secondaryClass}`}>
						{t("domainRegistration.connectToRegisterDomain")}
					</p>
				)}

				<button
					disabled={!signer || registerMutation.isPending}
					type="button"
					className={`w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
						signer && !registerMutation.isPending
							? buttonClass
							: disabledButtonClass
					}`}
					onClick={(): void => {
						registerMutation.mutate();
					}}
				>
					{registerMutation.isPending
						? t("domainRegistration.signingAndRegistering")
						: t("domainRegistration.register", { defaultValue: "Register" })}
				</button>

				{registerMutation.isError && (
					<p className="text-xs text-red-500">
						{apiErrorMessage(
							registerMutation.error,
							t("domainRegistration.registrationFailed")
						)}
					</p>
				)}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className={`rounded-lg border p-4 ${cardClass}`}>
				<h3 className={`mb-2 text-sm font-semibold ${headingClass}`}>
					{t("domainRegistration.registerDomainTitle")}
				</h3>
				<div className="flex gap-2">
					<input
						className={`flex-1 rounded-md border px-3 py-2 text-sm ${inputClass}`}
						placeholder={t("domainRegistration.searchPlaceholder")}
						type="text"
						value={searchInput}
						onChange={(event): void => {
							setSearchInput(sanitizeHandle(event.target.value));
						}}
						onKeyDown={(event): void => {
							if (event.key === "Enter") {
								handleSearch();
							}
						}}
					/>
					<button
						disabled={searchInput.length === 0}
						type="button"
						className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
							searchInput.length > 0 ? buttonClass : disabledButtonClass
						}`}
						onClick={handleSearch}
					>
						{t("domainRegistration.check")}
					</button>
				</div>

				{normalizedNameLength > 0 &&
					normalizedNameLength < MIN_HANDLE_LENGTH && (
						<p className={`mt-2 text-xs ${secondaryClass}`}>
							{t("domainRegistration.minLength", { count: MIN_HANDLE_LENGTH })}
						</p>
					)}

				{availabilityQuery.isLoading &&
					normalizedNameLength >= MIN_HANDLE_LENGTH && (
						<p className={`mt-2 text-xs ${secondaryClass}`}>
							{t("domainRegistration.checking")}
						</p>
					)}

				{availabilityQuery.isError &&
					normalizedNameLength >= MIN_HANDLE_LENGTH && (
						<p className="mt-2 text-xs font-medium text-red-500">
							{t("domainRegistration.availabilityError")}
						</p>
					)}

				{availabilityQuery.data && (
					<div className="mt-3">
						{availabilityQuery.data.available ? (
							<div className="flex items-center justify-between">
								<div>
									<span className="text-xs font-medium text-green-500">
										{t("domainRegistration.available")}
									</span>
									<span className={`ml-2 text-xs ${secondaryClass}`}>
										{t("domainRegistration.feePerYear", {
											fee: formatFee(getAnnualFee(searchName)),
										})}
									</span>
								</div>
								<button
									className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${buttonClass}`}
									type="button"
									onClick={(): void => {
										setSelectedName(availabilityQuery.data.name);
									}}
								>
									{t("domainRegistration.register")}
								</button>
							</div>
						) : (
							<div>
								<span className="text-xs font-medium text-red-500">
									{t("domainRegistration.taken")}
								</span>
								{availabilityQuery.data.identity && (
									<span className={`ml-2 text-xs ${secondaryClass}`}>
										{t("domainRegistration.ownedBy")}{" "}
										<span className="font-mono">
											{availabilityQuery.data.identity.cryptoId.slice(0, 12)}...
										</span>
									</span>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			<div className={`rounded-lg border p-4 ${cardClass}`}>
				<h4 className={`mb-2 text-xs font-semibold ${headingClass}`}>
					{t("domainRegistration.pricing")}
				</h4>
				<div className="space-y-1">
					{PRICING_TIERS.map((tier) => (
						<div
							key={tier.label}
							className={`flex items-center justify-between text-xs ${secondaryClass}`}
						>
							<span>
								{tier.label}{" "}
								<span className="font-mono opacity-60">({tier.example})</span>
							</span>
							<span className="font-medium">
								{t("domainRegistration.feePerYearShort", { fee: tier.fee })}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
