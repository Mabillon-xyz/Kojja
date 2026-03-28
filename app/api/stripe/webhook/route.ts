import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { sendProposalPaidEmail } from '@/lib/resend'
import { generateProposalPdf } from '@/lib/pdf-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const slug = session.metadata?.proposal_slug
    const proposalId = session.metadata?.proposal_id

    if (!slug || !proposalId) return NextResponse.json({ received: true })

    const supabase = await createServiceClient()

    // Update proposal to paid
    const { data: proposal } = await supabase
      .from('proposals')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq('id', proposalId)
      .select()
      .single()

    if (!proposal) return NextResponse.json({ received: true })

    // Get owner info
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', proposal.user_id)
      .single()

    if (ownerProfile?.email) {
      try {
        const pdfBuffer = await generateProposalPdf(proposal)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL

        await sendProposalPaidEmail({
          ownerEmail: ownerProfile.email,
          clientEmail: proposal.client_email,
          clientName: proposal.client_name,
          clientCompany: proposal.client_company,
          proposalTitle: proposal.title,
          proposalUrl: `${appUrl}/p/${slug}`,
          amount: proposal.price,
          currency: proposal.currency,
          pdfBuffer,
        })
      } catch (err) {
        console.error('Email/PDF error:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
