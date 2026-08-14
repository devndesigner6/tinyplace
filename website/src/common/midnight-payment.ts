import { TinyPlaceError } from "@tinyhumansai/tinyplace";

export const MIDNIGHT_SETUP_MESSAGE =
	"Midnight settlement is required. Start the local stack: pnpm midnight:up && pnpm midnight:deploy";

/** Re-throws 402 payment challenges as a Midnight setup hint; passes other errors through. */
export function rethrowMidnightPaymentRequired(error: unknown): never {
	if (error instanceof TinyPlaceError && error.status === 402) {
		throw new Error(MIDNIGHT_SETUP_MESSAGE);
	}
	throw error;
}
