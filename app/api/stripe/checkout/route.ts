import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { sendProposalSignedEmail } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const { slug, signerName, signatureData } = await req.json()

  if (!slug || !signerName || !signatureData) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
  }

  if (proposal.status === 'expired') {
    return NextResponse.json({ error: 'This proposal has expired' }, { status: 410 })
  }

  if (proposal.status === 'paid') {
    return NextResponse.json({ error: 'This proposal has already been paid' }, { status: 409 })
  }

  // Save signature (allow re-signing if a previous Stripe attempt failed)
  await supabase
    .from('proposals')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signer_name: signerName,
      signature_data: signatureData,
    })
    .eq('slug', slug)

  // Create Stripe Checkout Session
  const price = Math.round(Number(proposal.price) * 100) // explicit Number() conversion
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kojanews.com'

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: proposal.currency ?? 'usd',
            product_data: {
              name: proposal.title,
              description: `Proposal for ${proposal.client_company}`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      customer_email: proposal.client_email,
      metadata: { proposal_slug: slug, proposal_id: proposal.id },
      success_url: `${appUrl}/p/${slug}?payment=success`,
      cancel_url: `${appUrl}/p/${slug}`,
    })

    await supabase
      .from('proposals')
      .update({ stripe_session_id: session.id })
      .eq('slug', slug)

    // Notify owner that the proposal was signed
    try {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', proposal.user_id)
        .single()

      if (ownerProfile?.email) {
        await sendProposalSignedEmail({
          ownerEmail: ownerProfile.email,
          ownerName: ownerProfile.full_name ?? '',
          clientName: proposal.client_name,
          clientCompany: proposal.client_company,
          proposalTitle: proposal.title,
          proposalUrl: `${appUrl}/p/${slug}`,
        })
      }
    } catch (emailErr) {
      console.error('[checkout] signed email error:', emailErr)
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    // Roll back signature so client can retry
    await supabase
      .from('proposals')
      .update({ status: 'sent', signed_at: null, signer_name: null, signature_data: null })
      .eq('slug', slug)

    const message = err?.message ?? 'Failed to create payment session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
