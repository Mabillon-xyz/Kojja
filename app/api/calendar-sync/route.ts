import { NextResponse } from "next/server";
import { Composio } from "@composio/core";

const EDENRED_CAL_ID = "vto228d2ulbg8h03q713i3bl5c7acq4a@import.calendar.google.com";
const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";
const CONNECTED_ACCOUNT_ID = "f88faf67-55a6-42d2-94c7-888907ac5226";
const SYNC_MARKER_PREFIX = "[edenred-sync:";

let composioClient: Composio | null = null;

function getComposio(): Composio {
  if (!composioClient) {
    composioClient = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  }
  return composioClient;
}

type CalEvent = {
  iCalUID?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  status?: string;
};

async function listEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalEvent[]> {
  const result = await getComposio().tools.execute("GOOGLECALENDAR_EVENTS_LIST", {
    connectedAccountId: CONNECTED_ACCOUNT_ID,
    version: "20260312_00",
    arguments: {
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 500,
    },
  });

  if (!result.successful) {
    throw new Error((result.error as string) ?? "Failed to list events");
  }

  return ((result.data as { items?: CalEvent[] })?.items ?? []);
}

function extractSyncedUid(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/\[edenred-sync:([^\]]+)\]/);
  return match ? match[1] : null;
}

function getDurationHours(
  start: { dateTime?: string },
  end: { dateTime?: string }
): number {
  if (!start.dateTime || !end.dateTime) return 1;
  const ms = new Date(end.dateTime).getTime() - new Date(start.dateTime).getTime();
  return Math.max(0.25, ms / (1000 * 60 * 60));
}

export async function POST() {
  if (!process.env.COMPOSIO_API_KEY) {
    return NextResponse.json({ error: "COMPOSIO_API_KEY not configured" }, { status: 500 });
  }

  const now = new Date();
  const threeWeeks = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  const timeMin = now.toISOString();
  const timeMax = threeWeeks.toISOString();

  try {
    const [allEdenred, personalEvents] = await Promise.all([
      listEvents(EDENRED_CAL_ID, timeMin, timeMax),
      listEvents(PERSONAL_CAL_ID, timeMin, timeMax),
    ]);

    const edenredEvents = allEdenred.filter((e) => e.status !== "cancelled");

    const syncedUids = new Set(
      personalEvents.map((e) => extractSyncedUid(e.description)).filter(Boolean)
    );

    let created = 0;
    let skipped = 0;
    const createdTitles: string[] = [];
    const errors: string[] = [];

    for (const event of edenredEvents) {
      const uid = event.iCalUID ?? "";

      if (syncedUids.has(uid)) {
        skipped++;
        continue;
      }

      // Skip all-day events (no dateTime)
      if (!event.start?.dateTime) {
        skipped++;
        continue;
      }

      const marker = `${SYNC_MARKER_PREFIX}${uid}]`;
      const description = event.description
        ? `${marker}\n\n${event.description}`
        : marker;

      const durationHours = getDurationHours(event.start, event.end ?? {});

      try {
        const result = await getComposio().tools.execute("GOOGLECALENDAR_CREATE_EVENT", {
          connectedAccountId: CONNECTED_ACCOUNT_ID,
          version: "20260312_00",
          arguments: {
            summary: event.summary ?? "(EdenRed event)",
            start_datetime: event.start.dateTime,
            timezone: event.start.timeZone ?? "Europe/Paris",
            event_duration_hour: durationHours,
            calendar_id: PERSONAL_CAL_ID,
            description,
            ...(event.location ? { location: event.location } : {}),
          },
        });

        if (!result.successful) {
          errors.push(`${event.summary}: ${result.error}`);
        } else {
          createdTitles.push(event.summary ?? "?");
          created++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${event.summary ?? "?"}: ${msg}`);
      }
    }

    return NextResponse.json({
      created,
      skipped,
      total: edenredEvents.length,
      createdTitles,
      errors,
      syncedUntil: threeWeeks.toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
