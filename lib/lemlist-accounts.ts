export type AccountId = "clement" | "sandro";

export type LemlistAccount = {
  id: AccountId;
  label: string;
  apiKey: () => string;
  campaignId: () => string;
  coachCampaignId: () => string;
  cacheKey: string;
};

// Use functions so env vars are read at request time, not at module load time
export const LEMLIST_ACCOUNTS: Record<AccountId, LemlistAccount> = {
  clement: {
    id: "clement",
    label: "Clément",
    apiKey: () => (process.env.LEMLIST_API_KEY ?? "").trim(),
    campaignId: () => (process.env.LEMLIST_CAMPAIGN_ID ?? "cam_JC7mjRSoLg4MACxR6").trim(),
    coachCampaignId: () => (process.env.LEMLIST_COACH_CAMPAIGN_ID ?? "").trim(),
    cacheKey: "lemlist_conversion_clement",
  },
  sandro: {
    id: "sandro",
    label: "Sandro",
    apiKey: () => (process.env.LEMLIST_API_KEY_SANDRO ?? "").trim(),
    campaignId: () => (process.env.LEMLIST_CAMPAIGN_ID_SANDRO ?? "cam_QRLG9eJkNdBC2t8wT").trim(),
    coachCampaignId: () => (process.env.LEMLIST_COACH_CAMPAIGN_ID_SANDRO ?? "").trim(),
    cacheKey: "lemlist_conversion_sandro",
  },
};

export const ALL_ACCOUNT_IDS = Object.keys(LEMLIST_ACCOUNTS) as AccountId[];

export function getAccount(id: string): LemlistAccount | null {
  return LEMLIST_ACCOUNTS[id as AccountId] ?? null;
}
