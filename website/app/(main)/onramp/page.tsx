import type { Metadata } from "next";

import { SectionPage } from "@src/components/layout/SectionPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Midnight Wallet",
	description:
		"Local Midnight identity and setup for tiny.place settlement.",
};

export default function Page(): React.ReactElement {
	return <SectionPage section="onramp" />;
}
