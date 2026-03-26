import { NextRequest, NextResponse } from "next/server";
import { getCachedConversion, syncLemlistConversion } from "@/lib/lemlist-sync";
import { getAccount, type AccountId } from "@/lib/lemlist-accounts";

export const maxDuration = 60;

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
  coachTotal: number;
  booked: number;
};

const EMPTY: ConversionData & { updatedAt: null } = {
  leads: [], total: 0, inCrm: 0, customers: 0, conversionRate: "0%", coachTotal: 0, booked: 0, updatedAt: null,
};

/** Fast read — returns cached data. */
export async function GET(req: NextRequest) {
  const accountId = (req.nextUrl.searchParams.get("account") ?? "clement") as AccountId;
  if (!getAccount(accountId)) return NextResponse.json({ error: "Unknown account" }, { status: 400 });

  const cached = await getCachedConversion(accountId);
  return NextResponse.json(cached ?? EMPTY);
}

/** Slow write — re-fetches from Lemlist, rebuilds cache. */
export async function POST(req: NextRequest) {
  const accountId = (req.nextUrl.searchParams.get("account") ?? "clement") as AccountId;
  const account = getAccount(accountId);
  if (!account) return NextResponse.json({ error: "Unknown account" }, { status: 400 });
  if (!account.apiKey()) return NextResponse.json({ error: `API key not configured for ${accountId}` }, { status: 500 });

  try {
    const result = await syncLemlistConversion(accountId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
