import { NextResponse } from "next/server";
import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";

const EDENRED_CAL_ID = "vto228d2ulbg8h03q713i3bl5c7acq4a@import.calendar.google.com";
const PERSONAL_CAL_ID = "clement.guiraudpro@gmail.com";

async function fetchAllEvents(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<calendar_v3.Schema$Event[]> {
  const events: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;

  while (true) {
    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
      pageToken,
    });
    const items = response.data.items ?? [];
    events.push(...items);
    pageToken = response.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return events;
}

export async function POST() {
  const tokenRaw = process.env.GOOGLE_TOKEN_PERSONAL;
  if (!tokenRaw) {
    return NextResponse.json({ error: "GOOGLE_TOKEN_PERSONAL not configured" }, { status: 500 });
  }

  let tokenData: Record<string, any>;
  try {
    tokenData = JSON.parse(tokenRaw);
  } catch {
    return NextResponse.json({ error: "Invalid GOOGLE_TOKEN_PERSONAL JSON" }, { status: 500 });
  }

  const auth = new google.auth.OAuth2(tokenData.client_id, tokenData.client_secret);
  auth.setCredentials({
    access_token: tokenData.token,
    refresh_token: tokenData.refresh_token,
    scope: Array.isArray(tokenData.scopes) ? tokenData.scopes.join(" ") : tokenData.scopes,
  });

  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const threeWeeks = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  const timeMin = now.toISOString();
  const timeMax = threeWeeks.toISOString();

  const allEdenred = await fetchAllEvents(calendar, EDENRED_CAL_ID, timeMin, timeMax);
  const edenredEvents = allEdenred.filter((e) => e.status !== "cancelled");

  const personalEvents = await fetchAllEvents(calendar, PERSONAL_CAL_ID, timeMin, timeMax);
  const syncedUids = new Set(
    personalEvents
      .map((e) => e.extendedProperties?.private?.["edenred_icaluid"])
      .filter(Boolean)
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

    const newEvent: calendar_v3.Schema$Event = {
      summary: event.summary ?? "(EdenRed event)",
      start: event.start ?? undefined,
      end: event.end ?? undefined,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      extendedProperties: {
        private: {
          synced_from_edenred: "true",
          edenred_icaluid: uid,
        },
      },
    };

    try {
      await calendar.events.insert({ calendarId: PERSONAL_CAL_ID, requestBody: newEvent });
      createdTitles.push(event.summary ?? "?");
      created++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${event.summary}: ${msg}`);
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
}
