import { TinyPlaceError } from "@tinyhumansai/tinyplace";

export const MIDNIGHT_SETUP_MESSAGE =
	"Midnight settlement is unavailable for this deployment. Check the backend health status and configure deployed Midnight contracts before retrying.";

/** Re-throws 402 payment challenges with a truthful deployment hint. */
export function rethrowMidnightPaymentRequired(error: unknown): never {
	if (error instanceof TinyPlaceError && error.status === 402) {
		throw new Error(MIDNIGHT_SETUP_MESSAGE);
	}
	throw error;
}
