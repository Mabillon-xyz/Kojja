'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Proposal } from '@/types/proposal'
import { formatCurrency, formatDate } from '@/lib/utils'
import ProposalStatusBadge from './ProposalStatusBadge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

interface ProposalTableProps {
  proposals: Proposal[]
}

export default function ProposalTable({ proposals }: ProposalTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/p/${slug}`
    await navigator.clipboard.writeText(url)
    toast({ title: 'Link copied', description: 'Share this with your client.' })

    await fetch(`/api/proposals/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    })
    router.refresh()
  }

  async function deleteProposal(id: string) {
    if (!confirm('Delete this proposal? This cannot be undone.')) return
    setDeleting(id)
    await fetch(`/api/proposals/${id}`, { method: 'DELETE' })
    setDeleting(null)
    router.refresh()
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-20 text-[#555]">
        <p className="text-sm">No proposals yet. Create your first one above.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#252525] rounded-xl border border-[#383838] overflow-hidden overflow-x-auto">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow className="bg-[#2f2f2f] border-b border-[#383838] hover:bg-[#2f2f2f]">
            <TableHead className="font-medium text-[#888]">Proposal</TableHead>
            <TableHead className="font-medium text-[#888] hidden sm:table-cell">Client</TableHead>
            <TableHead className="font-medium text-[#888]">Status</TableHead>
            <TableHead className="font-medium text-[#888]">Value</TableHead>
            <TableHead className="font-medium text-[#888] hidden md:table-cell">Expires</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {proposals.map((proposal) => {
            const canEdit = proposal.status === 'draft' || proposal.status === 'sent'
            return (
              <TableRow key={proposal.id} className="border-b border-[#2f2f2f] hover:bg-[#2a2a2a]">
                <TableCell>
                  <Link
                    href={`/proposal-tool/${proposal.id}`}
                    className="font-medium text-sm text-[#e6e6e6] hover:text-white hover:underline"
                  >
                    {proposal.title}
                  </Link>
                  <p className="text-xs text-[#555] mt-0.5">{formatDate(proposal.created_at)}</p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <p className="text-sm text-[#c0c0c0]">{proposal.client_name}</p>
                  <p className="text-xs text-[#666]">{proposal.client_company}</p>
                </TableCell>
                <TableCell>
                  <ProposalStatusBadge status={proposal.status} />
                </TableCell>
                <TableCell className="text-sm font-medium text-[#e6e6e6]">
                  {formatCurrency(proposal.price, proposal.currency)}
                </TableCell>
                <TableCell className="text-sm text-[#666] hidden md:table-cell">
                  {formatDate(proposal.expires_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" asChild className="text-[#888] hover:text-[#e6e6e6] hover:bg-[#383838]">
                      <Link href={`/proposal-tool/${proposal.id}`}>View</Link>
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" asChild className="text-[#888] hover:text-[#e6e6e6] hover:bg-[#383838]">
                        <Link href={`/proposal-tool/${proposal.id}/edit`}>Edit</Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden sm:inline-flex text-[#888] hover:text-[#e6e6e6] hover:bg-[#383838]"
                      onClick={() => copyLink(proposal.slug)}
                    >
                      Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-400 hover:bg-red-950/40"
                      onClick={() => deleteProposal(proposal.id)}
                      disabled={deleting === proposal.id}
                    >
                      Del
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
