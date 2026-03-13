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

    // Mark as sent if still draft
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
      <div className="text-center py-20 text-neutral-400">
        <p className="text-sm">No proposals yet. Create your first one above.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-neutral-50/50">
            <TableHead className="font-medium text-neutral-600">Proposal</TableHead>
            <TableHead className="font-medium text-neutral-600">Client</TableHead>
            <TableHead className="font-medium text-neutral-600">Status</TableHead>
            <TableHead className="font-medium text-neutral-600">Value</TableHead>
            <TableHead className="font-medium text-neutral-600">Expires</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {proposals.map((proposal) => {
            const canEdit = proposal.status === 'draft' || proposal.status === 'sent'
            return (
              <TableRow key={proposal.id} className="hover:bg-neutral-50/50">
                <TableCell>
                  <Link
                    href={`/proposal-tool/${proposal.id}`}
                    className="font-medium text-sm hover:underline"
                  >
                    {proposal.title}
                  </Link>
                  <p className="text-xs text-neutral-400 mt-0.5">{formatDate(proposal.created_at)}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{proposal.client_name}</p>
                  <p className="text-xs text-neutral-400">{proposal.client_company}</p>
                </TableCell>
                <TableCell>
                  <ProposalStatusBadge status={proposal.status} />
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {formatCurrency(proposal.price, proposal.currency)}
                </TableCell>
                <TableCell className="text-sm text-neutral-500">
                  {formatDate(proposal.expires_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/proposal-tool/${proposal.id}`}>View</Link>
                    </Button>
                    {canEdit && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/proposal-tool/${proposal.id}/edit`}>Edit</Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLink(proposal.slug)}
                    >
                      Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteProposal(proposal.id)}
                      disabled={deleting === proposal.id}
                    >
                      Delete
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
