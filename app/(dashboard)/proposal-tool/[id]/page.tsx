import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import ProposalDocument from '@/components/proposal-template/ProposalDocument'
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

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`
  const publicUrl = `${baseUrl}/p/${proposal.slug}`

  return (
    <div className="px-8 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <Link
            href="/proposal-tool"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Proposals
          </Link>
          <span className="text-muted-foreground/70">/</span>
          <span className="text-sm font-medium text-foreground truncate max-w-xs">
            {proposal.title}
          </span>
          <ProposalStatusBadge status={proposal.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportPdfButton proposalTitle={proposal.title} />
          <SendByEmailButton proposalId={id} clientEmail={proposal.client_email} />
          {canEdit && (
            <Link href={`/proposal-tool/${id}/edit`} className="inline-flex items-center h-7 px-2.5 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-all">
              Edit
            </Link>
          )}
        </div>
      </div>

      {/* Share panel */}
      <ShareUrlPanel url={publicUrl} proposalId={id} currentStatus={proposal.status} />

      {/* Proposal preview */}
      <div className="mt-6 bg-muted rounded-2xl border border-border shadow-sm overflow-hidden">
        <ProposalDocument proposal={proposal} />
      </div>
    </div>
  )
}
