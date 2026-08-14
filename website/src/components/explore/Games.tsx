"use client";

import { useTranslation } from "react-i18next";

import type { FunctionComponent } from "@src/common/types";
import { Chip } from "@src/components/ui/Chip";
import { useTabRoute } from "@src/hooks/use-tab-route";
import { RoomsWorldLoader } from "@src/views/RoomsWorldLoader";

const tabs = ["world", "poker"] as const;
type Tab = (typeof tabs)[number];

const tabLabelKeys: Record<Tab, string> = {
	world: "games.tabs.poker",
	poker: "games.tabs.poker",
};

export const Games = ({ isDark }: { isDark: boolean }): FunctionComponent => {
	const { t } = useTranslation();
	const { activeTab, setTab } = useTabRoute<Tab>(tabs, "world");

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
						{t(tabLabelKeys[tab], { defaultValue: tab })}
					</Chip>
				))}
			</div>
			<div className="h-[70vh] overflow-hidden rounded-lg border border-border">
				<RoomsWorldLoader />
			</div>
		</div>
	);
};
