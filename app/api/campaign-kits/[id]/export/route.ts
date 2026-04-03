import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Email = { subject: string; body: string }
type KitRow = {
  coach_name: string
  icp: string
  okrs: string[]
  hooks: string[]
  linkedin: string[]
  emails: Email[]
  created_at: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHTML(kit: KitRow, blur = false, autoPrint = false): string {
  const date = new Date(kit.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const okrsHtml = kit.okrs
    .map((okr, i) => {
      const doBlur = blur && i >= 2
      if (doBlur) {
        return `<li class="blurred-item">
        <div class="blurred-content"><span class="num">${i + 1}</span><span>${escapeHtml(okr)}</span></div>
        <div class="blur-overlay">🔒 Contenu réservé</div>
      </li>`
      }
      return `<li><span class="num">${i + 1}</span><span>${escapeHtml(okr)}</span></li>`
    })
    .join('\n      ')

  const hooksHtml = kit.hooks
    .map((hook, i) => `<div class="card">
      <div class="card-label">Accroche ${i + 1}</div>
      <p>${escapeHtml(hook)}</p>
    </div>`)
    .join('\n    ')

  const linkedinHtml = kit.linkedin
    .map((msg, i) => {
      const doBlur = blur && i >= 1
      if (doBlur) {
        return `<div class="blurred-item card">
        <div class="blurred-content">
          <div class="card-header">
            <span class="card-label">Message ${i + 1}</span>
            <span class="badge">${msg.length} chars</span>
          </div>
          <p class="pre">${escapeHtml(msg)}</p>
        </div>
        <div class="blur-overlay">🔒 Contenu réservé</div>
      </div>`
      }
      return `<div class="card">
      <div class="card-header">
        <span class="card-label">Message ${i + 1}</span>
        <span class="badge">${msg.length} chars</span>
      </div>
      <p class="pre">${escapeHtml(msg)}</p>
    </div>`
    })
    .join('\n    ')

  const emailsHtml = kit.emails
    .map((email, i) => {
      const doBlur = blur && i >= 1
      if (doBlur) {
        return `<div class="blurred-item card">
        <div class="blurred-content">
          <div class="card-label">Email ${i + 1}</div>
          <p class="email-subject">Objet : ${escapeHtml(email.subject)}</p>
          <p class="pre email-body">${escapeHtml(email.body)}</p>
        </div>
        <div class="blur-overlay">🔒 Contenu réservé</div>
      </div>`
      }
      return `<div class="card">
      <div class="card-label">Email ${i + 1}</div>
      <p class="email-subject">Objet : ${escapeHtml(email.subject)}</p>
      <p class="pre email-body">${escapeHtml(email.body)}</p>
    </div>`
    })
    .join('\n    ')

  const autoPrintScript = autoPrint
    ? `<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); }</script>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kit de campagne — ${escapeHtml(kit.coach_name)}</title>
  ${autoPrintScript}
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
    .header { margin-bottom: 40px; border-bottom: 2px solid #111827; padding-bottom: 20px; }
    .brand { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; color: #6b7280; margin-bottom: 10px; }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #6b7280; }
    .section { margin: 32px 0; }
    h2 {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 12px;
    }
    .block {
      background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 8px; padding: 16px 18px; font-size: 14px;
    }
    .list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .list li { display: flex; gap: 12px; font-size: 14px; align-items: flex-start; }
    .num {
      width: 22px; height: 22px; border-radius: 50%; background: #111827; color: #fff;
      font-size: 11px; font-weight: 700; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; margin-top: 2px;
    }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 18px; margin: 10px 0; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 8px; }
    .badge { font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 999px; background: #f3f4f6; color: #6b7280; }
    .email-subject { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
    .email-body { font-size: 13px; color: #374151; }
    .pre { white-space: pre-wrap; }
    .footer { margin-top: 56px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px; display: flex; justify-content: space-between; }
    /* ── Blur styles ── */
    .blurred-item { position: relative; overflow: hidden; border-radius: 8px; }
    .blurred-content { filter: blur(6px); user-select: none; pointer-events: none; }
    .blur-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #374151;
      background: rgba(249,250,251,0.25);
      pointer-events: none;
    }
    @media print {
      body { margin: 0; }
      @page { margin: 20mm; }
      .blurred-content { filter: blur(6px); }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">KOJ²A</div>
    <h1>${escapeHtml(kit.coach_name)}</h1>
    <p class="meta">Kit de campagne Lemlist · Généré le ${date}</p>
  </div>

  <div class="section">
    <h2>Profil client idéal (ICP)</h2>
    <div class="block">${escapeHtml(kit.icp)}</div>
  </div>

  <div class="section">
    <h2>OKRs — Résultats clés</h2>
    <ul class="list">
      ${okrsHtml}
    </ul>
  </div>

  <div class="section">
    <h2>Accroches de personnalisation</h2>
    ${hooksHtml}
  </div>

  <div class="section">
    <h2>Messages LinkedIn</h2>
    ${linkedinHtml}
  </div>

  <div class="section">
    <h2>Séquence email (3 emails)</h2>
    ${emailsHtml}
  </div>

  <div class="footer">
    <span>Généré par Koj²a — votre assistant de prospection pour coachs</span>
    <span>${date}</span>
  </div>
</body>
</html>`
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url)
  const format = url.searchParams.get('format') ?? 'html'
  const blur = url.searchParams.get('blur') === '1'
  const supabase = getSupabase()

  const { data: kit, error } = await supabase
    .from('campaign_kits')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !kit) {
    return NextResponse.json({ error: 'Kit not found' }, { status: 404 })
  }

  const isPdf = format === 'pdf'
  const html = buildHTML(kit as KitRow, blur, isPdf)
  const slug = kit.coach_name.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase()

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // HTML → download attachment; PDF → inline so browser can print it
      ...(isPdf
        ? {}
        : { 'Content-Disposition': `attachment; filename="kit-${slug}.html"` }),
    },
  })
}
