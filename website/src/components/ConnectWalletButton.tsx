"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useTinyplaceWallet } from "@src/common/tinyplace-wallet";
import { useAppStore } from "@src/store/app";
import { useAuthStore } from "@src/store/auth";
import type { FunctionComponent } from "@src/common/types";

function truncateAddress(address: string): string {
	if (address.length <= 9) return address;
	return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Connect / account menu for the local Midnight identity stored in the browser.
 */
export const ConnectWalletButton = (): FunctionComponent => {
	const { t } = useTranslation();
	const wallet = useTinyplaceWallet();
	const agentId = useAuthStore((state) => state.agentId);
	const isDark = useAppStore((state) => state.theme === "dark");
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);
	const [connectModalOpen, setConnectModalOpen] = useState(false);

	const address = wallet.connected ? (wallet.address ?? agentId ?? null) : null;
	const isConnected = wallet.connected && Boolean(address);

	const label = wallet.connecting
		? t("common.connecting", { defaultValue: "Connecting..." })
		: isConnected && address
			? truncateAddress(address)
			: t("wallet.connect", { defaultValue: "Connect Wallet" });

	const onClick = (): void => {
		if (isConnected) {
			setMenuOpen(true);
		} else {
			setConnectModalOpen(true);
		}
	};

	const className = isConnected
		? `px-3 py-1.5 rounded-full border text-sm font-medium transition-colors flex items-center gap-2 ${
				isDark
					? "border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 bg-neutral-900"
					: "border-neutral-300 text-neutral-700 hover:text-black hover:border-neutral-400 bg-neutral-100"
			}`
		: "px-4 py-1.5 rounded-full bg-blue-600 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-500 active:scale-95";

	const openProfile = (): void => {
		setMenuOpen(false);
		router.push("/profile");
	};

	const logout = (): void => {
		setMenuOpen(false);
		void wallet.disconnect();
	};

	const connectLace = async (): Promise<void> => {
		setConnectModalOpen(false);
		await wallet.openConnectModal();
	};

	const panelClass = isDark
		? "border-neutral-800 bg-neutral-950 text-white"
		: "border-neutral-200 bg-white text-black";
	const mutedClass = isDark ? "text-neutral-400" : "text-neutral-500";
	const itemClass = `w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
		isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"
	}`;

	return (
		<>
			<button className={className} type="button" onClick={onClick}>
				{isConnected && (
					<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
				)}
				{label}
			</button>

			{/* Connect Modal */}
			{connectModalOpen && !isConnected && (
				<div
					aria-modal="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
					role="dialog"
					onClick={(): void => {
						setConnectModalOpen(false);
					}}
				>
					<div
						className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${panelClass}`}
						onClick={(event): void => {
							event.stopPropagation();
						}}
					>
						<div className="flex items-center justify-between">
							<h3 className="text-base font-bold">Connect Wallet</h3>
							<button
								className="text-neutral-400 hover:text-white"
								type="button"
								onClick={() => setConnectModalOpen(false)}
							>
								✕
							</button>
						</div>
						<p className={`mt-1 text-xs ${mutedClass}`}>
							Connect your Midnight Network wallet or Agent Signer to authenticate.
						</p>

						<div className="mt-5 flex flex-col gap-3">
							<button
								className="w-full flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 text-left text-sm font-medium transition-all hover:border-purple-500/60 hover:bg-purple-900/30"
								type="button"
								onClick={connectLace}
							>
								<div className="flex items-center gap-3">
									<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20 text-purple-400 font-bold text-xs">
										MN
									</span>
									<div>
										<div className="font-semibold text-white">Midnight Lace Wallet</div>
										<div className="text-xs text-neutral-400">Midnight Browser Extension</div>
									</div>
								</div>
								<span className="text-xs text-purple-400 font-semibold">Connect →</span>
							</button>

							<button
								className="w-full flex items-center justify-between rounded-xl border border-neutral-700/50 bg-neutral-900/50 p-3.5 text-left text-sm font-medium transition-all hover:border-neutral-600 hover:bg-neutral-800/50"
								type="button"
								onClick={connectLace}
							>
								<div className="flex items-center gap-3">
									<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 font-bold text-xs">
										ID
									</span>
									<div>
										<div className="font-semibold text-white">Agent Identity Signer</div>
										<div className="text-xs text-neutral-400">Local Cryptographic Identity</div>
									</div>
								</div>
								<span className="text-xs text-neutral-400 font-semibold">Connect →</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Account Menu */}
			{menuOpen && isConnected && (
				<div
					aria-modal="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					role="dialog"
					onClick={(): void => {
						setMenuOpen(false);
					}}
				>
					<div
						className={`w-full max-w-xs rounded-xl border p-4 shadow-xl ${panelClass}`}
						onClick={(event): void => {
							event.stopPropagation();
						}}
					>
						<h3 className="text-sm font-semibold">{t("wallet.account")}</h3>
						{address && (
							<p className={`mt-1 truncate text-xs ${mutedClass}`}>{address}</p>
						)}
						<div className="mt-4 flex flex-col gap-1">
							<button className={itemClass} type="button" onClick={openProfile}>
								{t("wallet.openProfile")}
							</button>
							<button
								className={`${itemClass} text-rose-500`}
								type="button"
								onClick={logout}
							>
								{t("wallet.logout")}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};
