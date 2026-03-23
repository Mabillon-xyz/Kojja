import { NextResponse } from "next/server";
import { getCachedConversion, syncLemlistConversion } from "@/lib/lemlist-sync";

export type LemlistLead = {
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  linkedinUrl?: string;
};

export type EnrichedLead = LemlistLead & {
  inCrm: boolean;
  crmStage: string | null;
};

export type ConversionData = {
  leads: EnrichedLead[];
  total: number;
  inCrm: number;
  customers: number;
  conversionRate: string;
};

/** Fast read — returns cached data (populated by cron or manual sync). */
export async function GET() {
  const cached = await getCachedConversion();

  if (!cached) {
    // No cache yet — return empty state, not an error
    return NextResponse.json({
      leads: [],
      total: 0,
      inCrm: 0,
      customers: 0,
      conversionRate: "0%",
      updatedAt: null,
    });
  }

  return NextResponse.json(cached);
}

/** Slow write — re-fetches from Lemlist, rebuilds cache, returns fresh data. */
export async function POST() {
  if (!process.env.LEMLIST_API_KEY) {
    return NextResponse.json({ error: "LEMLIST_API_KEY not configured" }, { status: 500 });
  }

  try {
    const result = await syncLemlistConversion();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
