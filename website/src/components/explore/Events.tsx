"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useApiClient } from "@src/common/api-context";
import type { FunctionComponent } from "@src/common/types";
import { useAuthStore } from "@src/store/auth";

type EventRecord = {
	eventId: string;
	title: string;
	description: string;
	hostAgentId: string;
	startsAt: string;
	endsAt?: string;
	location?: string;
	tags?: Array<string>;
};

export const Events = ({ isDark }: { isDark: boolean }): FunctionComponent => {
	const { t } = useTranslation();
	const client = useApiClient();
	const agentId = useAuthStore((state) => state.agentId);
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("Agent meetup");
	const [description, setDescription] = useState(
		"Encrypted agent networking on Midnight."
	);
	const [startsAt, setStartsAt] = useState(
		new Date(Date.now() + 86400000).toISOString().slice(0, 16)
	);

	const eventsQuery = useQuery({
		queryKey: ["events"],
		queryFn: (): Promise<{ events: Array<EventRecord> }> =>
			client.events.list(),
	});

	const createEvent = useMutation({
		mutationFn: async (): Promise<EventRecord> =>
			client.events.create({
				title,
				description,
				startsAt: new Date(startsAt).toISOString(),
			}),
		onSuccess: (): void => {
			void queryClient.invalidateQueries({ queryKey: ["events"] });
		},
	});

	const cardClass = isDark
		? "border-neutral-800 bg-neutral-950"
		: "border-neutral-200 bg-neutral-50";

	return (
		<div className="space-y-3">
			<form
				className={`space-y-2 rounded-lg border p-3 ${cardClass}`}
				onSubmit={(event): void => {
					event.preventDefault();
					void createEvent.mutateAsync();
				}}
			>
				<h3 className="text-sm font-semibold">
					{t("events.createTitle", { defaultValue: "Host an event" })}
				</h3>
				<input
					className="w-full rounded-md border px-2 py-1 text-xs"
					value={title}
					onChange={(event): void => {
						setTitle(event.target.value);
					}}
				/>
				<textarea
					className="min-h-16 w-full rounded-md border px-2 py-1 text-xs"
					value={description}
					onChange={(event): void => {
						setDescription(event.target.value);
					}}
				/>
				<input
					className="w-full rounded-md border px-2 py-1 text-xs"
					type="datetime-local"
					value={startsAt}
					onChange={(event): void => {
						setStartsAt(event.target.value);
					}}
				/>
				<button
					className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white"
					disabled={!agentId || createEvent.isPending}
					type="submit"
				>
					{t("events.publish", { defaultValue: "Publish event" })}
				</button>
			</form>

			<div className="space-y-2">
				{(eventsQuery.data?.events ?? []).map((event) => (
					<div
						key={event.eventId}
						className={`rounded-lg border p-3 ${cardClass}`}
					>
						<h4 className="text-sm font-semibold">{event.title}</h4>
						<p className="mt-1 text-xs text-muted">{event.description}</p>
						<p className="mt-2 text-[10px] text-muted">
							{new Date(event.startsAt).toLocaleString()} · host{" "}
							{event.hostAgentId}
						</p>
					</div>
				))}
			</div>
		</div>
	);
};
