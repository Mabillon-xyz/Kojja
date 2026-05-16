-- ============================================================
-- Migration : portail client Koj²a
-- Coller dans Supabase SQL Editor et exécuter
-- ============================================================

-- 1. Table clients
CREATE TABLE IF NOT EXISTS clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  lemlist_api_key TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Admin (sans role 'client') voit tous les clients ; client voit seulement sa ligne
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'client'
);
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'client'
);
CREATE POLICY "clients_delete" ON clients FOR DELETE TO authenticated USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'client'
);
CREATE POLICY "clients_service_role" ON clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Colonne client_id sur lemlist_campaigns (NULL = campagnes de Clément)
ALTER TABLE lemlist_campaigns ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- 3. Mise à jour RLS lemlist_campaigns : client voit seulement ses campagnes
DROP POLICY IF EXISTS "Auth users read lemlist_campaigns" ON lemlist_campaigns;
CREATE POLICY "campaigns_select" ON lemlist_campaigns FOR SELECT TO authenticated USING (
  -- Admin voit tout
  (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'client'
  OR
  -- Client voit seulement ses campagnes
  client_id = (SELECT id FROM clients WHERE user_id = auth.uid())
);
