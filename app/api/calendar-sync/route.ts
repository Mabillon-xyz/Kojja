import { NextResponse } from "next/server";
import { Composio } from "@composio/core";

const EDENRED_CAL_ID = "clement.guiraud@edenred.com";
const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";
const USER_ID = "pg-test-aa13515c-f26c-44f3-aa7a-9d87bab3072a";
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
    userId: USER_ID,
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

  // Composio wraps the Google Calendar response under response_data
  const raw = result.data as Record<string, unknown>;
  const unwrapped = (raw?.response_data ?? raw) as { items?: CalEvent[] };
  return unwrapped?.items ?? [];
}

function extractSyncedUid(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/\[edenred-sync:([^\]]+)\]/);
  return match ? match[1] : null;
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

      const endDateTime = event.end?.dateTime ?? new Date(
        new Date(event.start.dateTime).getTime() + 60 * 60 * 1000
      ).toISOString();

      try {
        const result = await getComposio().tools.execute("GOOGLECALENDAR_CREATE_EVENT", {
          userId: USER_ID,
          version: "20260312_00",
          arguments: {
            summary: event.summary ?? "(EdenRed event)",
            start_datetime: event.start.dateTime,
            end_datetime: endDateTime,
            timezone: event.start.timeZone ?? "Europe/Paris",
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
      debug: {
        edenredRaw: allEdenred.length,
        edenredFiltered: edenredEvents.length,
        personalEvents: personalEvents.length,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
