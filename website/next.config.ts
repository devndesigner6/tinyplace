import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
	turbopack: {
		root: repositoryRoot,
	},
	env: {
		NEXT_PUBLIC_API_BASE_URL:
			process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.tiny.place",
		NEXT_PUBLIC_SETTLEMENT_NETWORK:
			process.env.NEXT_PUBLIC_SETTLEMENT_NETWORK ?? "midnight",
		NEXT_PUBLIC_MIDNIGHT_NETWORK:
			process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK ?? "undeployed",
		NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
	},
	async redirects() {
		return [
			{
				source: "/reputation",
				destination: "/leaderboards",
				permanent: true,
			},
			{
				source: "/reputation/:tab*",
				destination: "/leaderboards",
				permanent: true,
			},
		];
	},
};

export default nextConfig;
