-- Add account_id to linkedin_daily_sends
ALTER TABLE linkedin_daily_sends ADD COLUMN IF NOT EXISTS account_id TEXT NOT NULL DEFAULT 'clement';
ALTER TABLE linkedin_daily_sends DROP CONSTRAINT IF EXISTS linkedin_daily_sends_pkey;
ALTER TABLE linkedin_daily_sends ADD PRIMARY KEY (date, account_id);

-- Add account_id to email_daily_sends
ALTER TABLE email_daily_sends ADD COLUMN IF NOT EXISTS account_id TEXT NOT NULL DEFAULT 'clement';
ALTER TABLE email_daily_sends DROP CONSTRAINT IF EXISTS email_daily_sends_pkey;
ALTER TABLE email_daily_sends ADD PRIMARY KEY (date, account_id);

-- Add lemlist_account_id to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lemlist_account_id TEXT;
