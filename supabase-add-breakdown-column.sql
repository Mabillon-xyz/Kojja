-- Add per-campaign breakdown to email_daily_sends
ALTER TABLE email_daily_sends ADD COLUMN IF NOT EXISTS breakdown JSONB;
