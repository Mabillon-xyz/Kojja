import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProposalDocument from '@/components/proposal-template/ProposalDocument'
import { Button } from '@/components/ui/button'
import ProposalStatusBadge from '@/components/dashboard/ProposalStatusBadge'
import ShareUrlPanel from '@/components/shared/ShareUrlPanel'
import ExportPdfButton from '@/components/shared/ExportPdfButton'
import SendByEmailButton from '@/components/shared/SendByEmailButton'
import { Proposal } from '@/types/proposal'

export default async function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!data) notFound()
  const proposal = data as Proposal

  const canEdit = proposal.status === 'draft' || proposal.status === 'sent'
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/p/${proposal.slug}`

  return (
    <div className="px-8 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <Link
            href="/proposal-tool"
            className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            ← Proposals
          </Link>
          <span className="text-neutral-200">/</span>
          <span className="text-sm font-medium text-neutral-900 truncate max-w-xs">
            {proposal.title}
          </span>
          <ProposalStatusBadge status={proposal.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportPdfButton proposalTitle={proposal.title} />
          <SendByEmailButton proposalId={id} clientEmail={proposal.client_email} />
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/proposal-tool/${id}/edit`}>Edit</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Share panel */}
      <ShareUrlPanel url={publicUrl} proposalId={id} currentStatus={proposal.status} />

      {/* Proposal preview */}
      <div className="mt-6 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <ProposalDocument proposal={proposal} mode="preview" />
      </div>
    </div>
  )
}
