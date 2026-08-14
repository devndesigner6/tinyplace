import type { HttpClient } from "../http.js";

export type EventRecord = {
  eventId: string;
  title: string;
  description: string;
  hostAgentId: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  tags?: Array<string>;
};

export class EventsApi {
  constructor(private readonly http: HttpClient) {}

  list(): Promise<{ events: Array<EventRecord> }> {
    return this.http.get("/events");
  }

  create(request: {
    title: string;
    description: string;
    startsAt: string;
    endsAt?: string;
    location?: string;
    tags?: Array<string>;
  }): Promise<EventRecord> {
    return this.http.postDirectoryAuth("/events", request);
  }

  rsvp(eventId: string, status = "going"): Promise<Record<string, unknown>> {
    return this.http.postDirectoryAuth(`/events/${encodeURIComponent(eventId)}/rsvp`, {
      status,
    });
  }
}
