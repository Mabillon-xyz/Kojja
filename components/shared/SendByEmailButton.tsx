'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function SendByEmailButton({
  proposalId,
  clientEmail,
}: {
  proposalId: string
  clientEmail: string
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSend() {
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'send_to_client', proposalId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error ?? `HTTP ${res.status}`)
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch (err) {
      setErrorMsg(String(err))
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSend}
        disabled={status === 'sending' || status === 'sent'}
        title={`Send to ${clientEmail}`}
      >
        {status === 'sending' && 'Sending…'}
        {status === 'sent' && 'Sent ✓'}
        {status === 'error' && 'Error — retry'}
        {status === 'idle' && 'Send by email'}
      </Button>
      {status === 'error' && errorMsg && (
        <span className="text-xs text-red-500 max-w-48 text-right">{errorMsg}</span>
      )}
    </div>
  )
}
