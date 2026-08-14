// Pure helpers for rendering token amounts in base (minor) units.

const KNOWN_ASSETS: Record<string, { decimals: number; symbol: string }> = {
	USDC: { decimals: 6, symbol: "USDC" },
	CASH: { decimals: 6, symbol: "CASH" },
	NIGHT: { decimals: 6, symbol: "NIGHT" },
	DUST: { decimals: 6, symbol: "DUST" },
};

function assetDecimals(asset?: string): number {
	if (!asset) {
		return 6;
	}
	const known = KNOWN_ASSETS[asset.toUpperCase()];
	if (known) {
		return known.decimals;
	}
	return 6;
}

function assetSymbol(asset?: string): string {
	if (!asset) {
		return "USDC";
	}
	const known = KNOWN_ASSETS[asset.toUpperCase()];
	if (known) {
		return known.symbol;
	}
	if (asset.length > 12) {
		return `${asset.slice(0, 4)}…${asset.slice(-4)}`;
	}
	return asset;
}

/** Decimals for a token asset (symbol or contract id); defaults to 6 when unknown. */
export function tokenDecimals(asset?: string): number {
	return assetDecimals(asset);
}

/**
 * Converts a base-unit (minor-unit) integer string to its decimal token value
 * as a string, e.g. ("1000000", 6) => "1". Returns "0" for non-finite input.
 */
export function minorUnitsToDecimal(
	baseUnits: string,
	decimals: number
): string {
	const n = Number(baseUnits);
	if (!Number.isFinite(n)) {
		return "0";
	}
	return String(n / 10 ** decimals);
}

/**
 * Formats a base-unit amount for display with its friendly asset symbol.
 */
export function formatTokenAmount(baseUnits: string, asset?: string): string {
	const decimals = tokenDecimals(asset);
	const human = Number(minorUnitsToDecimal(baseUnits, decimals));
	const symbol = assetSymbol(asset);
	return `${human.toLocaleString(undefined, {
		maximumFractionDigits: decimals,
	})} ${symbol}`;
}

/**
 * Formats a base-unit amount of a USD-pegged asset as a dollar string.
 */
export function formatUsdFromBaseUnits(
	baseUnits: string,
	asset?: string
): string {
	const dollars = Number(minorUnitsToDecimal(baseUnits, tokenDecimals(asset)));
	return `$${dollars.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}
