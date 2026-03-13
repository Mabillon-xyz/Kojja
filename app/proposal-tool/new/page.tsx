'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const STEPS = [
  { at: 0,  label: 'Analyzing project requirements…' },
  { at: 4,  label: 'Writing executive summary…' },
  { at: 8,  label: 'Crafting scope of work…' },
  { at: 13, label: 'Building pricing table…' },
  { at: 18, label: 'Drafting approval terms…' },
  { at: 23, label: 'Finalizing proposal…' },
]

function getProgress(elapsed: number): number {
  const target = 88
  const duration = 28
  const t = Math.min(elapsed / duration, 1)
  return target * (1 - Math.pow(1 - t, 2.5))
}

function GeneratingOverlay({ elapsed }: { elapsed: number }) {
  const progress = getProgress(elapsed)
  const currentStep = [...STEPS].reverse().find((s) => elapsed >= s.at) ?? STEPS[0]
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`

  return (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full max-w-sm px-8 text-center">
        <div className="relative w-16 h-16 mx-auto mb-8">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e5e5" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28"
              fill="none" stroke="#171717" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-neutral-700">
            {Math.round(progress)}%
          </span>
        </div>
        <h2 className="text-base font-semibold text-neutral-900 mb-2">Generating your proposal</h2>
        <p className="text-sm text-neutral-500 mb-6 min-h-[20px] transition-all duration-500">
          {currentStep.label}
        </p>
        <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden mb-4">
          <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.8s ease' }} />
        </div>
        <p className="text-xs text-neutral-400">{timeStr} elapsed · usually takes 15–25s</p>
      </div>
    </div>
  )
}

export default function NewProposalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientCompany: '',
    clientEmail: '',
    price: '',
    currency: 'usd',
    expiresAt: '',
    description: '',
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price: parseFloat(form.price),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }
    router.push(`/proposal-tool/${data.id}`)
  }

  return (
    <>
      {loading && <GeneratingOverlay elapsed={elapsed} />}

      <div className="px-8 py-8">
        <div className="max-w-2xl">
          <div className="mb-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm text-neutral-400 hover:text-neutral-700 mb-4 block"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-semibold tracking-tight">New proposal</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Fill in the details — AI will write the full proposal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-800">Client</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="clientName">Name</Label>
                  <Input
                    id="clientName"
                    placeholder="Jane Smith"
                    value={form.clientName}
                    onChange={(e) => set('clientName', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientCompany">Company</Label>
                  <Input
                    id="clientCompany"
                    placeholder="Acme Inc."
                    value={form.clientCompany}
                    onChange={(e) => set('clientCompany', e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="clientEmail">Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="jane@acme.com"
                    value={form.clientEmail}
                    onChange={(e) => set('clientEmail', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Proposal details */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-800">Proposal details</h2>
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Website Redesign for Acme Inc."
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Total price (USD)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="5000"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiresAt">
                    Expiry date{' '}
                    <span className="text-neutral-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => set('expiresAt', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-800">Project description</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Describe what you&apos;re delivering. The AI will use this to write the full proposal.
                </p>
              </div>
              <Textarea
                id="description"
                placeholder="We're building a full redesign of their e-commerce store, including a new checkout flow, mobile-first design, and Shopify integration…"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                required
                rows={6}
                className="resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={loading}>Generate proposal</Button>
              <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
