import { cryptoIdToPublicKeyBase64 } from "@tinyhumansai/tinyplace";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Strips any leading `@` from a handle for display/keying. */
export function strip(name: string): string {
	return name.replace(/^@+/, "");
}

/**
 * Normalizes raw handle input to the canonical registrable form: lowercase
 * `a-z`, digits, and `_` only (drops `@`, spaces, and any other character). Use
 * on every handle text input so the user can't submit an invalid name.
 */
export function sanitizeHandle(input: string): string {
	return input.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

const BTN_BASE =
	"rounded-md text-xs font-medium transition-colors disabled:cursor-not-allowed";

/** Secondary/ghost button (outlined), theme-aware. */
export function ghostButtonClass(isDark: boolean): string {
	return [
		BTN_BASE,
		"border",
		isDark
			? "border-neutral-700 text-neutral-200 hover:bg-neutral-800 disabled:border-neutral-800 disabled:text-neutral-600"
			: "border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:border-neutral-200 disabled:text-neutral-400",
	].join(" ");
}

/** Solid accent button (blue/orange/emerald/rose), theme-aware disabled state. */
export function accentButtonClass(
	isDark: boolean,
	tone: "blue" | "orange" | "emerald" | "rose" = "blue"
): string {
	const tones: Record<string, string> = {
		blue: "bg-blue-600 hover:bg-blue-500",
		orange: "bg-orange-600 hover:bg-orange-500",
		emerald: "bg-emerald-600 hover:bg-emerald-500",
		rose: "bg-rose-600 hover:bg-rose-500",
	};
	return [
		BTN_BASE,
		"text-white",
		tones[tone] ?? tones["blue"],
		isDark
			? "disabled:bg-neutral-800 disabled:text-neutral-600"
			: "disabled:bg-neutral-200 disabled:text-neutral-400",
	].join(" ");
}

export function daysLeft(
	expiresAt: string | undefined,
	now: number = Date.now()
): number | null {
	if (!expiresAt) {
		return null;
	}
	const expiry = new Date(expiresAt).getTime();
	if (Number.isNaN(expiry)) {
		return null;
	}
	return Math.ceil((expiry - now) / MS_PER_DAY);
}

export function expiryLabel(
	expiresAt: string | undefined,
	now: number = Date.now()
): string | null {
	const remaining = daysLeft(expiresAt, now);
	if (remaining === null) {
		return null;
	}
	return remaining < 0
		? `expired ${String(Math.abs(remaining))}d ago`
		: `${String(remaining)}d left`;
}

export function isExpired(
	expiresAt: string | undefined,
	now: number = Date.now()
): boolean {
	if (!expiresAt) {
		return false;
	}
	const expiry = new Date(expiresAt).getTime();
	if (Number.isNaN(expiry)) {
		return false;
	}
	return expiry < now;
}

export function statusTone(status: string): string {
	switch (status) {
		case "active":
			return "bg-emerald-600/20 text-emerald-500";
		case "expiring":
			return "bg-amber-600/20 text-amber-500";
		case "auction":
			return "bg-orange-600/20 text-orange-500";
		default:
			return "bg-neutral-600/20 text-neutral-400";
	}
}

/**
 * Derives the recipient `cryptoId` + base64 `publicKey` from a wallet address
 * (base58 Ed25519 cryptoId). Throws if the address is not valid.
 */
export function deriveRecipient(address: string): {
	cryptoId: string;
	publicKey: string;
} {
	const cryptoId = address.trim();
	return {
		cryptoId,
		publicKey: cryptoIdToPublicKeyBase64(cryptoId),
	};
}
