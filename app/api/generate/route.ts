import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateProposalContent } from '@/lib/claude'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company')
    .eq('id', user.id)
    .single()

  const body = await req.json()
  const { title, clientName, clientCompany, clientEmail, description, price, currency, expiresAt } = body

  if (!title || !clientName || !clientCompany || !clientEmail || !description || !price) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const content = await generateProposalContent({
      description,
      clientName,
      clientCompany,
      senderName: profile?.full_name ?? '',
      senderCompany: profile?.company ?? '',
      price: Number(price),
      currency: currency ?? 'usd',
    })

    const slug = nanoid(21)

    const { data: proposal, error } = await supabase
      .from('proposals')
      .insert({
        user_id: user.id,
        slug,
        title,
        client_name: clientName,
        client_company: clientCompany,
        client_email: clientEmail,
        description,
        content,
        price: Number(price),
        currency: currency ?? 'usd',
        status: 'draft',
        expires_at: expiresAt ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: proposal.id, slug: proposal.slug })
  } catch (err: any) {
    console.error('Generation error:', err)
    const message =
      err?.error?.error?.message ??
      err?.message ??
      'Failed to generate proposal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
