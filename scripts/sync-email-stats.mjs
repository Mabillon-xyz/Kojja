import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Resolve paths relative to script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local manually
const envPath = join(__dirname, '../.env.local');
console.log('Reading env from:', envPath);
const envContent = readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) return;
  const key = line.slice(0, eqIdx).trim();
  let value = line.slice(eqIdx + 1).trim();
  // Remove surrounding quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[key] = value;
});

console.log('Loaded env keys:', Object.keys(env).filter(k => k.includes('LEMLIST')));

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const LEMLIST_API_KEY = env.LEMLIST_API_KEY;
if (!LEMLIST_API_KEY) {
  console.error('LEMLIST_API_KEY not found in .env.local');
  process.exit(1);
}
console.log('LEMLIST_API_KEY loaded:', LEMLIST_API_KEY.slice(0, 8) + '...');

const basicAuth = Buffer.from(`:${LEMLIST_API_KEY}`).toString('base64');

// Get all active campaigns
console.log('Fetching active campaigns from Lemlist...');
const res = await fetch('https://api.lemlist.com/api/campaigns?limit=100', {
  headers: { Authorization: `Basic ${basicAuth}` },
});
if (!res.ok) {
  console.error('Failed to fetch campaigns:', res.status);
  process.exit(1);
}
const campaigns = await res.json();
const activeCampaignIds = campaigns
  .filter(c => c.status !== 'draft' && !c.archived)
  .map(c => c._id);

console.log(`Found ${activeCampaignIds.length} active campaigns:`, activeCampaignIds);

// Sync last 21 days
const dates = [];
const today = new Date();
for (let i = 1; i <= 21; i++) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  dates.push(d.toISOString().slice(0, 10));
}

console.log('Syncing dates:', dates);

for (const date of dates) {
  const startDate = new Date(date + 'T00:00:00.000Z').toISOString();
  const end = new Date(date + 'T00:00:00.000Z');
  end.setUTCDate(end.getUTCDate() + 1);
  const endDate = end.toISOString();

  // Fetch stats for all campaigns in parallel
  const results = await Promise.all(
    activeCampaignIds.map(async (campaignId) => {
      const r = await fetch(
        `https://api.lemlist.com/api/v2/campaigns/${campaignId}/stats?startDate=${startDate}&endDate=${endDate}`,
        { headers: { Authorization: `Basic ${basicAuth}` } }
      );
      if (!r.ok) return 0;
      const data = await r.json();
      return data.messagesSent ?? 0;
    })
  );

  const totalSent = results.reduce((sum, count) => sum + count, 0);
  console.log(`${date}: ${totalSent} emails sent`);

  // Upsert into Supabase
  await supabase.from('email_daily_sends').upsert({
    date,
    email_count: totalSent,
    synced_at: new Date().toISOString(),
  });

  console.log(`  → saved to DB`);
}

console.log('\nDone! Email stats synced for the last 21 days.');
