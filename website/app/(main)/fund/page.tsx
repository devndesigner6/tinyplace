import type { Metadata } from "next";

import { SectionPage } from "@src/components/layout/SectionPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Midnight Wallet",
	description: "Fund and configure your local Midnight wallet for tiny.place.",
};

export default function Page(): React.ReactElement {
	return <SectionPage section="onramp" />;
}
