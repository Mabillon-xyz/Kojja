import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import nodemailer from 'nodemailer'
import { getAccount } from '@/lib/lemlist-accounts'

export const maxDuration = 90

const LEMLIST_API = 'https://api.lemlist.com/api'
const SUMMARY_RECIPIENT = 'contact@clementguiraud.fr'

// ── Lemlist helpers ───────────────────────────────────────────────────────────

function lemlistAuth(apiKey: string) {
  return `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`
}

async function lemlistPost(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${LEMLIST_API}${path}`, {
    method: 'POST',
    headers: { Authorization: lemlistAuth(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Lemlist ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as Record<string, unknown>
}

function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// ── Claude spec generation ────────────────────────────────────────────────────

const CAMPAIGN_RULES_SUMMARY = `
Règles campagne Koj²a (résumé) :
- Séquence : email j0 → linkedinInvite j3 → email j6 → conditional linkedinInviteAccepted j8 (waitUntil) → [YES: linkedinSend j8, break-up email j11] [NO: break-up email j11]
- Objet email : 2–4 mots, ex : "{{firstName}} — un avis ?" / "Votre pipeline, {{firstName}}" / "{{firstName}}"
- Corps email 1 : {{icebreaker}} en ouverture + qui-je-suis (1 phrase) + offre avec KPI concret + question ouverte + signature "Clément"
- Ne pas mentionner d'outil, pas de "automatisation", pas de jargon startup, pas de listes à puces
- Domaine envoi : clement.guiraudpro@gmail.com
- Convention nommage campagne : [Persona] | [Secteur/Ville] — [Mois Année]
- Campagne créée en pause — leads à ajouter manuellement ensuite
`

interface CampaignSpec {
  campaignName: string
  campaignNumber: number
  hypothesis: string
  icpDescription: string
  zone: string
  messageVariation: string
  rationale: string
  email1Subject: string
  email1Body: string
  linkedinNote: string
  email2Subject: string
  email2Body: string
  linkedinStep4Message: string
  emailBreakupSubject: string
  emailBreakupBody: string
}

async function generateCampaignSpec(campaignLogContent: string): Promise<CampaignSpec> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: `Tu es l'assistant outbound de Koj²a. Tu analyses le journal de campagne et décides quelle est la prochaine expérience à lancer.

Output ONLY valid JSON. No markdown, no commentary. Start with { and end with }.

${CAMPAIGN_RULES_SUMMARY}

Génère un JSON avec exactement cette structure :
{
  "campaignName": "string — format [Persona] | [Secteur/Ville] — Mai 2026",
  "campaignNumber": number,
  "hypothesis": "string — l'hypothèse testée en 1 phrase",
  "icpDescription": "string — description du persona ciblé",
  "zone": "string — zone géographique France",
  "messageVariation": "string — ex: Variation A email court, LinkedIn-first, etc.",
  "rationale": "string — 2-3 phrases expliquant pourquoi cette hypothèse maintenant",
  "email1Subject": "string — 2-4 mots avec {{firstName}}",
  "email1Body": "string — corps email 1 plain text, {{icebreaker}} en première ligne, paragraphes séparés par \\n\\n",
  "linkedinNote": "string — note LinkedIn invite ≤300 caractères",
  "email2Subject": "string — 2-4 mots avec {{firstName}}",
  "email2Body": "string — corps email 2 plain text",
  "linkedinStep4Message": "string — message LinkedIn j8 si invite acceptée",
  "emailBreakupSubject": "string — 1-2 mots avec {{firstName}}",
  "emailBreakupBody": "string — corps email break-up plain text"
}`,
    messages: [
      {
        role: 'user',
        content: `Journal de campagne actuel :\n\n${campaignLogContent}\n\nAnalyse les campagnes existantes et les hypothèses en file d'attente. Choisis la prochaine hypothèse à tester — en priorité quelque chose de structurellement différent de ce qui a déjà été lancé (variation ICP, angle message, type de persona). Génère le JSON complet pour cette nouvelle campagne.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as CampaignSpec
}

// ── Campaign log update ───────────────────────────────────────────────────────

function buildCampaignSection(spec: CampaignSpec, campaignId: string): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `
---

### Campagne #${spec.campaignNumber} — ${spec.campaignName}

**ID Lemlist :** ${campaignId}
**Statut :** Draft ⏸ (créée automatiquement)
**Créée le :** ${date}

#### Ciblage
- **Persona :** ${spec.icpDescription}
- **Zone :** ${spec.zone}
- **Domaine envoi :** clement.guiraudpro@gmail.com
- **Variation message :** ${spec.messageVariation}

#### Hypothèse testée
${spec.hypothesis}

**Raisonnement :** ${spec.rationale}

#### Résultats *(à remplir dans 2–3 semaines)*
| Métrique | Valeur | Benchmark cible |
|----------|--------|-----------------|
| Taux d'ouverture email 1 | — | >40% |
| Taux de réponse email | — | >4% |
| Taux d'acceptance LinkedIn | — | >40% |
| RDV discovery bookés | — | ≥1 |

#### Décision
- [ ] À compléter après réception des données

`
}

function updateCampaignLogContent(
  content: string,
  spec: CampaignSpec,
  campaignId: string,
): string {
  let updated = content

  // Add row to overview table — find last data row (starts with "| N |")
  const overviewIdx = updated.indexOf('## Vue d\'ensemble')
  const nextSeparator = updated.indexOf('\n---\n', overviewIdx)
  if (overviewIdx !== -1 && nextSeparator !== -1) {
    const section = updated.slice(overviewIdx, nextSeparator)
    const rows = section.split('\n').filter((l) => /^\| \d+/.test(l))
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1]
      const lastRowPos = updated.lastIndexOf(lastRow, nextSeparator)
      const insertAt = lastRowPos + lastRow.length
      const newRow = `\n| ${spec.campaignNumber} | ${spec.campaignName} | Draft ⏸ (auto) | — | — | — | — | — |`
      updated = updated.slice(0, insertAt) + newRow + updated.slice(insertAt)
    }
  }

  // Insert new campaign section before "## Learnings cumulés"
  const learningsMarker = '\n## Learnings cumulés'
  const newSection = buildCampaignSection(spec, campaignId)
  if (updated.includes(learningsMarker)) {
    updated = updated.replace(learningsMarker, newSection + '\n## Learnings cumulés')
  } else {
    updated += newSection
  }

  return updated
}

// ── Summary email ─────────────────────────────────────────────────────────────

function buildSummaryHtml(spec: CampaignSpec, campaignId: string): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `
<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#171717;font-size:15px;line-height:1.6;">
  <h2 style="font-size:20px;font-weight:600;margin-bottom:4px;">Nouvelle campagne créée</h2>
  <p style="color:#737373;margin-top:0;font-size:13px;">Koj²a Outbound — ${date}</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
    <tr><td style="padding:6px 0;color:#737373;width:160px;vertical-align:top;">Campagne</td><td style="padding:6px 0;"><strong>${spec.campaignName}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">ID Lemlist</td><td style="padding:6px 0;"><a href="https://app.lemlist.com/campaign/${campaignId}" style="color:#4f46e5;">${campaignId}</a></td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">Hypothèse</td><td style="padding:6px 0;">${spec.hypothesis}</td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">ICP ciblé</td><td style="padding:6px 0;">${spec.icpDescription}</td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">Zone</td><td style="padding:6px 0;">${spec.zone}</td></tr>
    <tr><td style="padding:6px 0;color:#737373;vertical-align:top;">Variation</td><td style="padding:6px 0;">${spec.messageVariation}</td></tr>
  </table>
  <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;">Pourquoi cette hypothèse maintenant ?</p>
    <p style="margin:0;font-size:14px;color:#404040;">${spec.rationale}</p>
  </div>
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:16px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;">Email Step 1 — Objet : ${spec.email1Subject}</p>
    <pre style="margin:0;font-family:inherit;font-size:13px;color:#404040;white-space:pre-wrap;">${spec.email1Body}</pre>
  </div>
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:16px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;">LinkedIn Invite Note</p>
    <pre style="margin:0;font-family:inherit;font-size:13px;color:#404040;white-space:pre-wrap;">${spec.linkedinNote}</pre>
  </div>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;">
  <p style="font-size:13px;color:#737373;margin-bottom:12px;">La campagne est créée en draft — pas encore active. Ajoutez vos leads dans Lemlist, relisez les messages, puis lancez manuellement.</p>
  <a href="https://app.lemlist.com/campaign/${campaignId}" style="display:inline-block;padding:10px 20px;background:#171717;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">Ouvrir dans Lemlist →</a>
</div>
`
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const account = getAccount('clement')
    const apiKey = account?.apiKey()
    if (!apiKey) {
      return NextResponse.json({ error: 'LEMLIST_API_KEY not configured' }, { status: 500 })
    }

    // 1. Read campaign log from Supabase
    const supabase = await createServiceClient()
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('content')
      .eq('id', 'campaign-log')
      .single()

    if (docErr || !doc?.content) {
      return NextResponse.json({ error: 'Campaign log not found in Supabase' }, { status: 500 })
    }

    // 2. Generate campaign spec with Claude
    const spec = await generateCampaignSpec(doc.content)

    // 3. Create campaign in Lemlist (paused by default)
    const camp = await lemlistPost('/campaigns', apiKey, {
      name: spec.campaignName,
      timezone: 'Europe/Paris',
    })
    const campaignId = camp._id as string
    const sequenceId = camp.sequenceId as string

    // 4. Build the sequence — 5 steps
    // Step 1: Email j0
    await lemlistPost(`/sequences/${sequenceId}/steps`, apiKey, {
      type: 'email',
      delay: 0,
      subject: spec.email1Subject,
      message: textToHtml(spec.email1Body),
    })

    // Step 2: LinkedIn invite j3
    await lemlistPost(`/sequences/${sequenceId}/steps`, apiKey, {
      type: 'linkedinInvite',
      delay: 3,
      message: spec.linkedinNote,
    })

    // Step 3: Follow-up email j6 (reply in thread — empty subject)
    await lemlistPost(`/sequences/${sequenceId}/steps`, apiKey, {
      type: 'email',
      delay: 3,
      subject: spec.email2Subject,
      message: textToHtml(spec.email2Body),
    })

    // Step 4: Conditional j8 — waitUntil LinkedIn invite accepted
    const conditional = await lemlistPost(`/sequences/${sequenceId}/steps`, apiKey, {
      type: 'conditional',
      delay: 2,
      conditionKey: 'linkedinInviteAccepted',
      delayType: 'waitUntil',
    })

    type Condition = { sequenceId: string; fallback?: boolean }
    const conditions = (conditional.conditions as Condition[]) ?? []
    const yesSeqId = conditions.find((c) => !c.fallback)?.sequenceId
    const noSeqId = conditions.find((c) => c.fallback)?.sequenceId

    // Step 4a: LinkedIn send in YES branch (j8)
    if (yesSeqId) {
      await lemlistPost(`/sequences/${yesSeqId}/steps`, apiKey, {
        type: 'linkedinSend',
        delay: 0,
        message: spec.linkedinStep4Message,
      })
      // Break-up email j11 in YES branch
      await lemlistPost(`/sequences/${yesSeqId}/steps`, apiKey, {
        type: 'email',
        delay: 3,
        subject: spec.emailBreakupSubject,
        message: textToHtml(spec.emailBreakupBody),
      })
    }

    // Break-up email j11 in NO branch
    if (noSeqId) {
      await lemlistPost(`/sequences/${noSeqId}/steps`, apiKey, {
        type: 'email',
        delay: 3,
        subject: spec.emailBreakupSubject,
        message: textToHtml(spec.emailBreakupBody),
      })
    }

    // 5. Update campaign log document in Supabase
    const updatedContent = updateCampaignLogContent(doc.content, spec, campaignId)
    await supabase
      .from('documents')
      .update({ content: updatedContent })
      .eq('id', 'campaign-log')

    // 6. Send summary email
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
    await transporter.sendMail({
      from: `Koj²a <${process.env.GMAIL_USER}>`,
      to: SUMMARY_RECIPIENT,
      subject: `Koj²a — Nouvelle campagne créée : ${spec.campaignName}`,
      html: buildSummaryHtml(spec, campaignId),
    })

    return NextResponse.json({
      ok: true,
      campaignId,
      campaignName: spec.campaignName,
      hypothesis: spec.hypothesis,
      rationale: spec.rationale,
      lemlistUrl: `https://app.lemlist.com/campaign/${campaignId}`,
    })
  } catch (err) {
    console.error('[campaign-auto]', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
