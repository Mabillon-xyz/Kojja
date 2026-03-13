import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendProposalSignedEmail, sendProposalToClientEmail } from '@/lib/resend'

export async function POST(req: NextRequest) {
  try {
    const { type, proposalId } = await req.json()

    const supabase = await createServiceClient()

    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (proposalError || !proposal) {
      console.error('[email] proposal fetch error:', proposalError)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: owner } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', proposal.user_id)
      .single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (type === 'signed') {
      if (!owner?.email) {
        console.error('[email] owner email missing for signed notification')
        return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
      }
      await sendProposalSignedEmail({
        ownerEmail: owner.email,
        ownerName: owner.full_name ?? '',
        clientName: proposal.client_name,
        clientCompany: proposal.client_company,
        proposalTitle: proposal.title,
        proposalUrl: `${appUrl}/p/${proposal.slug}`,
      })
    }

    if (type === 'send_to_client') {
      if (!proposal.client_email) {
        return NextResponse.json({ error: 'No client email on proposal' }, { status: 400 })
      }
      await sendProposalToClientEmail({
        clientEmail: proposal.client_email,
        clientName: proposal.client_name,
        clientCompany: proposal.client_company,
        proposalTitle: proposal.title,
        proposalUrl: `${appUrl}/p/${proposal.slug}`,
        ownerName: owner?.full_name ?? '',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[email] unhandled error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
