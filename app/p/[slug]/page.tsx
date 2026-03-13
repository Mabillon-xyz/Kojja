import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Proposal } from '@/types/proposal'
import PublicProposalClient from './PublicProposalClient'

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ payment?: string }>
}) {
  const { slug } = await params
  const { payment } = await searchParams

  const supabase = await createClient()

  const { data } = await supabase
    .from('proposals')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!data) notFound()

  // Auto-expire on read
  const isExpiredNow = data.expires_at && new Date(data.expires_at) < new Date()
  if (isExpiredNow && data.status !== 'expired' && data.status !== 'paid') {
    await supabase
      .from('proposals')
      .update({ status: 'expired' })
      .eq('slug', slug)
    data.status = 'expired'
  }

  const proposal = data as Proposal
  const paymentSuccess = payment === 'success'

  return (
    <PublicProposalClient
      proposal={proposal}
      paymentSuccess={paymentSuccess}
    />
  )
}
