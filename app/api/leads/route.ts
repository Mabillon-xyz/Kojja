import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { enrichLead } from '@/lib/enrich-lead'

// Public endpoint — used by /book form (no auth required)
// Uses service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

function buildGCalLink(callDate: string, leadName: string): string {
  // callDate is "YYYY-MM-DDTHH:mm" from datetime-local input
  const start = callDate.replace(/[-:]/g, '').padEnd(15, '0')
  const d = new Date(callDate)
  d.setMinutes(d.getMinutes() + 30)
  const end = d.toISOString().replace(/[-:]/g, '').slice(0, 15)
  const title = encodeURIComponent(`Call Koj²a — ${leadName}`)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) {
    console.error('DELETE /api/leads error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ deleted: true })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { first_name, last_name, email, company_name, city, phone, message, comment, call_date } = body

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('leads')
      .insert([{
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        company_name: company_name?.trim() || null,
        city: city?.trim() || null,
        phone: phone?.trim() || null,
        message: message?.trim() || null,
        comment: comment?.trim() || null,
        call_date: call_date || null,
        stage: 'call_scheduled',
      }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Un lead avec cet email existe déjà' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ── Enrichissement automatique (non-bloquant) ─────────────────────────
    // Fast: Annuaire entreprises + Pappers (~1-2s), met à jour siren/naf/effectif
    enrichLead(data.id, data.company_name).catch(() => {})

    // Full Claude research — fire-and-forget, best-effort (peut être relancé manuellement)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    fetch(`${siteUrl}/api/leads/${data.id}/research`, { method: 'POST' }).catch(() => {})

    const fullName = `${first_name.trim()} ${last_name.trim()}`
    const owner = process.env.GMAIL_USER!

    // Emails — non-blocking: lead is already saved, email failures must not return 500
    try { await transporter.sendMail({
      from: `Koj²a <${owner}>`,
      to: email.trim().toLowerCase(),
      subject: 'Votre demande de call Koj²a est bien reçue',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
          <p style="margin-bottom: 16px;">Bonjour ${first_name.trim()},</p>
          <p style="margin-bottom: 16px;">
            Merci pour votre intérêt — votre demande de call est bien enregistrée.
            Je reviens vers vous sous 24h pour confirmer la date et vous envoyer le lien de réunion.
          </p>
          ${call_date ? `<p style="margin-bottom: 16px;">Date souhaitée : <strong>${new Date(call_date).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</strong></p>` : ''}
          <p style="margin-bottom: 24px;">À très vite,<br/>Clément — Koj²a</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="font-size: 12px; color: #737373;">Koj²a — votre assistant de prospection</p>
        </div>
      `,
    }) } catch (e) { console.error('Email to lead failed:', e) }

    // Notification to owner
    const gCalLink = call_date ? buildGCalLink(call_date, fullName) : null

    try { await transporter.sendMail({
      from: `Koj²a <${owner}>`,
      to: owner,
      subject: `Nouveau call réservé — ${fullName}${company_name ? ` (${company_name})` : ''}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
          <h2 style="font-size: 18px; margin-bottom: 20px;">Nouveau lead via /book</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #737373; width: 130px;">Nom</td><td><strong>${fullName}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: #737373;">Email</td><td>${email}</td></tr>
            ${phone ? `<tr><td style="padding: 6px 0; color: #737373;">Téléphone</td><td>${phone}</td></tr>` : ''}
            ${company_name ? `<tr><td style="padding: 6px 0; color: #737373;">Cabinet</td><td>${company_name}</td></tr>` : ''}
            ${city ? `<tr><td style="padding: 6px 0; color: #737373;">Ville</td><td>${city}</td></tr>` : ''}
            ${call_date ? `<tr><td style="padding: 6px 0; color: #737373;">Date souhaitée</td><td><strong>${new Date(call_date).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</strong></td></tr>` : ''}
            ${message ? `<tr><td style="padding: 6px 0; color: #737373; vertical-align: top;">Message</td><td>${message}</td></tr>` : ''}
          </table>
          ${gCalLink ? `
          <div style="margin-top: 24px;">
            <a href="${gCalLink}" style="display: inline-block; padding: 10px 20px; background: #171717; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px;">
              Ajouter à Google Calendar
            </a>
          </div>` : ''}
        </div>
      `,
    }) } catch (e) { console.error('Email to owner failed:', e) }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
