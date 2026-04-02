import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Annuaire des entreprises — tranche effectif → libellé lisible
const EFFECTIF_LABELS: Record<string, string> = {
  '00': '0 salarié',
  '01': '1–2 salariés',
  '02': '3–5 salariés',
  '03': '6–9 salariés',
  '11': '10–19 salariés',
  '12': '20–49 salariés',
  '21': '50–99 salariés',
  '22': '100–199 salariés',
  '31': '200–249 salariés',
  '32': '250–499 salariés',
  '41': '500–999 salariés',
  '42': '1 000–1 999 salariés',
  '51': '2 000–4 999 salariés',
  '52': '5 000–9 999 salariés',
  '53': '10 000 salariés et plus',
}

type EnrichedFields = {
  siren?: string
  forme_juridique?: string
  effectif?: string
  naf_code?: string
  naf_libelle?: string
  city?: string
}

/**
 * Enrichit un lead avec les données officielles (Annuaire entreprises + Pappers).
 * Opération rapide (< 2s), à appeler de façon synchrone à la création d'un lead.
 * Ne remplace jamais un champ déjà renseigné.
 */
export async function enrichLead(
  leadId: string,
  companyName: string | null,
): Promise<void> {
  if (!companyName) return

  const supabase = getServiceClient()
  const enriched: EnrichedFields = {}

  // ── Annuaire des entreprises (api.gouv.fr) — gratuit, sans clé ──────────
  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(companyName)}&limit=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (res.ok) {
      const data = await res.json()
      const r = data?.results?.[0] as Record<string, unknown> | undefined
      if (r) {
        if (r.siren) enriched.siren = String(r.siren)
        if (r.activite_principale) enriched.naf_code = String(r.activite_principale)
        if (r.libelle_activite_principale) enriched.naf_libelle = String(r.libelle_activite_principale)
        const tranche = r.tranche_effectif_salarie as string | undefined
        if (tranche) enriched.effectif = EFFECTIF_LABELS[tranche] ?? tranche
        const siege = r.siege as Record<string, unknown> | undefined
        if (siege?.libelle_commune) enriched.city = String(siege.libelle_commune)
      }
    }
  } catch { /* silent */ }

  // ── Pappers (si clé configurée) ─────────────────────────────────────────
  if (process.env.PAPPERS_API_KEY) {
    try {
      const url = `https://api.pappers.fr/v2/recherche?q=${encodeURIComponent(companyName)}&api_token=${process.env.PAPPERS_API_KEY}&_limit=1`
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
      if (res.ok) {
        const data = await res.json()
        const r = data?.resultats?.[0] as Record<string, unknown> | undefined
        if (r) {
          if (r.forme_juridique) enriched.forme_juridique = String(r.forme_juridique)
          if (!enriched.siren && r.siren) enriched.siren = String(r.siren)
        }
      }
    } catch { /* silent */ }
  }

  if (Object.keys(enriched).length === 0) return

  // Lire les champs existants pour ne pas écraser
  const { data: existing } = await supabase
    .from('leads')
    .select('siren, forme_juridique, effectif, naf_code, naf_libelle, city')
    .eq('id', leadId)
    .single()

  const updates: Record<string, string> = {}
  for (const [key, val] of Object.entries(enriched)) {
    const current = existing?.[key as keyof typeof existing]
    if (!current && val) updates[key] = val
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('leads').update(updates).eq('id', leadId)
  }
}
