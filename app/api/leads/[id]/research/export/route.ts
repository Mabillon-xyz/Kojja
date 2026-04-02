import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { LeadResearch } from '@/lib/lead-types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ICP_LABELS: Record<string, string> = {
  high: 'ICP élevé',
  medium: 'ICP moyen',
  low: 'ICP faible',
}

function buildHTML(research: LeadResearch, leadName: string): string {
  const icpColor =
    research.icp_match === 'high'
      ? '#16a34a'
      : research.icp_match === 'low'
      ? '#dc2626'
      : '#d97706'
  const icpBg =
    research.icp_match === 'high'
      ? '#dcfce7'
      : research.icp_match === 'low'
      ? '#fee2e2'
      : '#fef9c3'

  const date = new Date(research.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const sourcesHtml =
    research.sources && research.sources.length > 0
      ? `<div class="section">
        <h2>Sources</h2>
        <ul class="sources">
          ${research.sources.map(s => `<li><a href="${s}" target="_blank">${s}</a></li>`).join('\n          ')}
        </ul>
      </div>`
      : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recherche Coach — ${leadName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 760px;
      margin: 48px auto;
      padding: 0 24px 80px;
      color: #111827;
      line-height: 1.6;
    }
    .header { margin-bottom: 32px; }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .header .meta { font-size: 14px; color: #6b7280; margin-bottom: 12px; }
    .badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      color: ${icpColor};
      background: ${icpBg};
    }
    .section { margin: 28px 0; }
    h2 {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .content {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px 18px;
      font-size: 14px;
      white-space: pre-wrap;
    }
    .sources { font-size: 13px; color: #6b7280; padding-left: 18px; }
    .sources li { margin: 4px 0; }
    .sources a { color: #6b7280; word-break: break-all; }
    .footer { margin-top: 48px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px; }
    @media print {
      body { margin: 24px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${leadName}</h1>
    <p class="meta">Recherche générée le ${date} · Koj²a</p>
    <span class="badge">${ICP_LABELS[research.icp_match ?? 'medium'] ?? research.icp_match}</span>
  </div>

  <div class="section">
    <h2>Profil</h2>
    <div class="content">${research.profile_summary ?? ''}</div>
  </div>

  <div class="section">
    <h2>Adéquation ICP</h2>
    <div class="content">${research.icp_reason ?? ''}</div>
  </div>

  <div class="section">
    <h2>Accroche (icebreaker)</h2>
    <div class="content">${research.icebreaker ?? ''}</div>
  </div>

  <div class="section">
    <h2>Email — Objet</h2>
    <div class="content">${research.email_subject ?? ''}</div>
  </div>

  <div class="section">
    <h2>Email — Corps</h2>
    <div class="content">${research.email_body ?? ''}</div>
  </div>

  <div class="section">
    <h2>LinkedIn DM</h2>
    <div class="content">${research.linkedin_dm ?? ''}</div>
  </div>

  ${sourcesHtml}

  <div class="footer">Généré par Koj²a · ${date}</div>
</body>
</html>`
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const researchId = searchParams.get('researchId')
  const format = searchParams.get('format') ?? 'html'

  if (!researchId) {
    return NextResponse.json({ error: 'researchId is required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Fetch research record + lead name
  const [{ data: research, error: rErr }, { data: lead }] = await Promise.all([
    supabase.from('lead_research').select('*').eq('id', researchId).single(),
    supabase.from('leads').select('first_name, last_name').eq('id', params.id).single(),
  ])

  if (rErr || !research) {
    return NextResponse.json({ error: 'Research not found' }, { status: 404 })
  }

  const leadName = lead ? `${lead.first_name} ${lead.last_name}` : 'Coach'

  if (format === 'linkedin') {
    return NextResponse.json({ text: research.linkedin_dm ?? '' })
  }

  // html and pdf both return HTML (pdf uses browser print)
  const html = buildHTML(research as LeadResearch, leadName)

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...(format === 'html'
        ? { 'Content-Disposition': `attachment; filename="research-${leadName.replace(/\s+/g, '-').toLowerCase()}.html"` }
        : {}),
    },
  })
}
