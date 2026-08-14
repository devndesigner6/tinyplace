"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";

import { ApiProvider } from "@src/common/api-context";
import { ConnectionFooter } from "@src/components/ConnectionFooter";
import { E2EAuthBridge } from "@src/components/E2EAuthBridge";
import { ExploreShell } from "@src/components/layout/ExploreShell";
import { LocaleController } from "@src/components/LocaleController";
import { ThemeController } from "@src/components/ThemeController";
import { WebOnboardingGate } from "@src/components/onboard/WebOnboardingGate";
import { queryClient } from "@src/common/query-client";
import { WalletContextProvider } from "@src/common/wallet-context";
import "@src/common/i18n";
import "@src/common/sentry";

type ProvidersProperties = {
	children: ReactNode;
};

export function Providers({
	children,
}: ProvidersProperties): React.ReactElement {
	return (
		<QueryClientProvider client={queryClient}>
			<WalletContextProvider>
				<ApiProvider>
					<ThemeController />
					<LocaleController />
					<Suspense fallback={null}>
						<WebOnboardingGate />
					</Suspense>
					<ExploreShell>{children}</ExploreShell>
					<ConnectionFooter />
					<E2EAuthBridge />
				</ApiProvider>
			</WalletContextProvider>
		</QueryClientProvider>
	);
}
