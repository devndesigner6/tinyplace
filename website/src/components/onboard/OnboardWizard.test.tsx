import { fireEvent, render, screen } from "@testing-library/react";
import type {
	Identity,
	TinyPlaceClient,
	User,
} from "@tinyhumansai/tinyplace";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardWizard, WebOnboardWizard } from "./OnboardWizard";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));
vi.mock("next/navigation", () => ({
	useRouter: (): unknown => ({ push: routerPush }),
	useSearchParams: (): unknown => new URLSearchParams(),
}));

afterEach(() => {
	window.location.hash = "";
	routerPush.mockClear();
});

describe("OnboardWizard", () => {
	it("prompts for the onboarding link when no grant is present", () => {
		window.location.hash = "";
		render(<OnboardWizard />);
		expect(screen.getByText(/Onboarding link required/i)).toBeTruthy();
	});

	it("renders a valid onboarding grant from the URL fragment", () => {
		const wallet = "wallet-test";
		const encodedClaims =
			"eyJ3YWxsZXQiOiJ3YWxsZXQtdGVzdCIsIm93bmVyUHVibGljS2V5Ijoib3duZXItdGVzdCIsInNjb3BlIjpbXSwiZXhwaXJlc0F0IjoiMjA5OS0wMS0wMVQwMDowMDowMC4wMDBaIn0";
		const grant = `og1.${encodedClaims}.test-signature`;
		window.location.hash = `#grant=${encodeURIComponent(`${wallet}:${grant}`)}`;

		render(<OnboardWizard />);

		expect(screen.getByText(/Finish setting up your agent/i)).toBeTruthy();
		expect(screen.getByText(/Set up your profile/i)).toBeTruthy();
		// The short wallet uses the wallet carried by the parsed grant.
		expect(screen.getByText("wallet-test")).toBeTruthy();
	});
});

describe("WebOnboardWizard", () => {
	const stubClient = {} as TinyPlaceClient;

	it("navigates back and forth by clicking the stepper", () => {
		render(
			<WebOnboardWizard
				activeIdentities={[]}
				client={stubClient}
				user={{ emailVerified: true, displayName: "Ada" } as User}
				wallet="F8zMkwbG3hp1k2t3eQWQh9bsh8qrK8CtqfZ2dBrrW3Ee"
			/>
		);

		// A verified account with no active identity starts on the handle step;
		// jump back to the profile step via the current four-step stepper.
		expect(screen.getByText(/Claim your identity/i)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Profile" }));
		expect(screen.getByText(/Set up your profile/i)).toBeTruthy();
	});

	it("finalizes from the All set step via the Complete button", () => {
		// A fully set-up user (email + profile + active handle) lands on the done
		// step, where Complete returns them into the app.
		render(
			<WebOnboardWizard
				activeIdentities={[{ status: "active", username: "ada" } as Identity]}
				client={stubClient}
				user={{ emailVerified: true, displayName: "Ada" } as User}
				wallet="F8zMkwbG3hp1k2t3eQWQh9bsh8qrK8CtqfZ2dBrrW3Ee"
			/>
		);

		expect(screen.getByText(/You.re all set/i)).toBeTruthy();
		fireEvent.click(screen.getByText("Complete"));
		expect(routerPush).toHaveBeenCalledWith("/");
	});
});
