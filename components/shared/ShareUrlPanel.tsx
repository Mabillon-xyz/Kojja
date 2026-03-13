'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProposalStatus } from '@/types/proposal'

interface ShareUrlPanelProps {
  url: string
  proposalId: string
  currentStatus: ProposalStatus
}

export default function ShareUrlPanel({ url, proposalId, currentStatus }: ShareUrlPanelProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    if (currentStatus === 'draft') {
      await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      })
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3">
      <div className="flex-1">
        <p className="text-xs font-medium text-neutral-500 mb-1.5">Client link</p>
        <Input
          value={url}
          readOnly
          className="text-sm text-neutral-600 bg-neutral-50 border-neutral-200 cursor-default"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
      </div>
      <Button onClick={handleCopy} className="shrink-0 mt-5">
        {copied ? 'Copied!' : 'Copy link'}
      </Button>
    </div>
  )
}
