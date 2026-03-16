import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Public endpoint — used by /book form (no auth required)
// Uses service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { first_name, last_name, email, company_name, city, phone, message, call_date } = body

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

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
