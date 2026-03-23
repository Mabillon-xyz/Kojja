import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CAMPAIGN_ID = process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6";

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

/** Parse a CSV string into LemlistLead objects, handling quoted fields. */
function parseCsv(text: string): LemlistLead[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse a single CSV line respecting double-quoted fields
  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Map common Lemlist CSV column name variants
  const col = (row: string[], ...keys: string[]) => {
    for (const k of keys) {
      const idx = headers.indexOf(k);
      if (idx !== -1) return row[idx]?.trim() || undefined;
    }
    return undefined;
  };

  return lines.slice(1).map((line) => {
    const row = splitLine(line);
    return {
      email: col(row, "email"),
      firstName: col(row, "firstname", "first_name", "first name"),
      lastName: col(row, "lastname", "last_name", "last name"),
      companyName: col(row, "companyname", "company_name", "company"),
      linkedinUrl: col(row, "linkedinurl", "linkedin_url", "linkedin"),
    };
  }).filter((l) => l.email);  // drop rows with no email
}

export async function GET() {
  if (!process.env.LEMLIST_API_KEY) {
    return NextResponse.json({ error: "LEMLIST_API_KEY not configured" }, { status: 500 });
  }

  // 1. Fetch leads from Lemlist campaign export
  // v1 API uses HTTP Basic Auth: any username, API key as password
  const basicAuth = Buffer.from(`anystring:${process.env.LEMLIST_API_KEY}`).toString("base64");
  const lemlistRes = await fetch(
    `https://api.lemlist.com/api/campaigns/${CAMPAIGN_ID}/export/leads`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Basic ${basicAuth}` },
    }
  );

  const bodyText = await lemlistRes.text();
  console.log("[lemlist/conversion] status:", lemlistRes.status, "body[:100]:", bodyText.slice(0, 100));

  if (!lemlistRes.ok) {
    return NextResponse.json(
      { error: `Lemlist API error ${lemlistRes.status}`, detail: bodyText.slice(0, 300) },
      { status: lemlistRes.status }
    );
  }

  // Parse response — may be JSON or CSV
  let lemlistLeads: LemlistLead[] = [];

  if (bodyText.trim()) {
    const contentType = lemlistRes.headers.get("content-type") ?? "";
    const looksLikeJson = bodyText.trimStart().startsWith("[") || bodyText.trimStart().startsWith("{");

    if (looksLikeJson && !contentType.includes("text/csv")) {
      try {
        const raw = JSON.parse(bodyText);
        lemlistLeads = Array.isArray(raw) ? raw : (raw.leads ?? []);
      } catch {
        return NextResponse.json(
          { error: "Lemlist returned non-JSON response", detail: bodyText.slice(0, 300) },
          { status: 502 }
        );
      }
    } else {
      // Parse CSV — map column names case-insensitively
      lemlistLeads = parseCsv(bodyText);
    }
  }

  // 2. Fetch CRM leads (email, linkedin_url, stage only)
  const supabase = await createClient();
  const { data: crmLeads, error } = await supabase
    .from("leads")
    .select("email, linkedin_url, stage");

  if (error) {
    return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
  }

  // 3. Build lookup maps
  const byEmail = new Map<string, string>();
  const byLinkedin = new Map<string, string>();

  for (const lead of crmLeads ?? []) {
    if (lead.email) byEmail.set(lead.email.toLowerCase().trim(), lead.stage);
    if (lead.linkedin_url) byLinkedin.set(lead.linkedin_url.toLowerCase().trim(), lead.stage);
  }

  // 4. Enrich each Lemlist lead
  const enriched: EnrichedLead[] = lemlistLeads.map((ll) => {
    const stage =
      (ll.email ? byEmail.get(ll.email.toLowerCase().trim()) : undefined) ??
      (ll.linkedinUrl ? byLinkedin.get(ll.linkedinUrl.toLowerCase().trim()) : undefined) ??
      null;

    return { ...ll, inCrm: stage !== null, crmStage: stage };
  });

  const total = enriched.length;
  const inCrm = enriched.filter((l) => l.inCrm).length;
  const customers = enriched.filter((l) => l.crmStage === "customer").length;

  return NextResponse.json({
    leads: enriched,
    total,
    inCrm,
    customers,
    conversionRate: total > 0 ? Math.round((customers / total) * 100) + "%" : "0%",
  } satisfies ConversionData);
}
