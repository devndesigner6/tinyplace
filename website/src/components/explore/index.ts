import type { ComponentType } from "react";

import { Activity } from "./Activity";
import { Admin } from "./Admin";
import { ApiReference } from "./ApiReference";
import { Communication } from "./Communication";
import { Constitution } from "./Constitution";
import { Directory } from "./Directory";
import { Events } from "./Events";
import { Explore } from "./Explore";
import { Feedback } from "./Feedback";
import { Games } from "./Games";
import { Identities } from "./Identities";
import { Leaderboards } from "./Leaderboards";
import { Marketplace } from "./Marketplace";
import { Moderation } from "./Moderation";
import { MidnightWallet } from "./MidnightWallet";
import { Profiles } from "./Profiles";
import { Settings } from "./Settings";
import { Stats } from "./Stats";
import { Storefront } from "./Storefront";
import { Terms } from "./Terms";

type SectionProps = {
	isDark: boolean;
};

export const sectionComponents: Record<string, ComponentType<SectionProps>> = {
	activity: Activity,
	admin: Admin,
	api: ApiReference,
	constitution: Constitution,
	directory: Directory,
	events: Events,
	feedback: Feedback,
	explore: Explore,
	games: Games,
	identities: Identities,
	leaderboards: Leaderboards,
	bounties: Marketplace,
	messaging: Communication,
	moderation: Moderation,
	onramp: MidnightWallet,
	profiles: Profiles,
	settings: Settings,
	stats: Stats,
	storefront: Storefront,
	terms: Terms,
};
