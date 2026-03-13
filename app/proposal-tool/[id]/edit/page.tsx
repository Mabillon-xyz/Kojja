'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Proposal, ProposalContent, ChallengeItem, PricingLineItem, PaymentScheduleItem, ProposalLanguage } from '@/types/proposal'

export default function EditProposalPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [content, setContent] = useState<ProposalContent | null>(null)
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/proposals/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProposal(data)
        // Normalize: migrate old executiveSummary → introduction
        const c: ProposalContent = data.content
        if (c && !c.introduction && c.executiveSummary) {
          c.introduction = c.executiveSummary
        }
        setContent(c)
      })
  }, [id])

  if (!proposal || !content) {
    return <div className="text-sm text-neutral-400 py-20 text-center">Loading…</div>
  }

  if (['signed', 'paid'].includes(proposal.status)) {
    return (
      <div className="max-w-lg py-20">
        <h1 className="text-xl font-semibold mb-2">Proposal is locked</h1>
        <p className="text-sm text-neutral-500 mb-4">
          This proposal has been signed and cannot be edited.
        </p>
        <Button variant="outline" onClick={() => router.back()}>Go back</Button>
      </div>
    )
  }

  // --- Language ---
  async function handleLanguageChange(l: ProposalLanguage) {
    if (l === (content?.language ?? 'en')) return
    setTranslating(true)
    setError('')
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, targetLanguage: l }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Translation failed')
      setContent(data.content)
    } catch (err: any) {
      setError(err.message ?? 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  // --- Challenges ---
  function updateChallenge(i: number, field: keyof ChallengeItem, value: string) {
    setContent((c) => {
      if (!c) return c
      const updated = [...c.challenges]
      updated[i] = { ...updated[i], [field]: value }
      return { ...c, challenges: updated }
    })
  }

  function removeChallenge(i: number) {
    setContent((c) => {
      if (!c) return c
      return { ...c, challenges: c.challenges.filter((_, idx) => idx !== i) }
    })
  }

  function addChallenge() {
    setContent((c) => {
      if (!c) return c
      return { ...c, challenges: [...c.challenges, { challenge: '', deliverable: '' }] }
    })
  }

  // --- Pricing ---
  function updateLineItem(i: number, field: keyof PricingLineItem, value: string | number) {
    setContent((c) => {
      if (!c) return c
      const updated = [...c.pricing.lineItems]
      updated[i] = { ...updated[i], [field]: value }
      const subtotal = updated.reduce((s, item) => s + item.total, 0)
      return { ...c, pricing: { ...c.pricing, lineItems: updated, subtotal, total: subtotal } }
    })
  }

  function removeLineItem(i: number) {
    setContent((c) => {
      if (!c || c.pricing.lineItems.length <= 1) return c
      const updated = c.pricing.lineItems.filter((_, idx) => idx !== i)
      const subtotal = updated.reduce((s, item) => s + item.total, 0)
      return { ...c, pricing: { ...c.pricing, lineItems: updated, subtotal, total: subtotal } }
    })
  }

  function addLineItem() {
    setContent((c) => {
      if (!c) return c
      return {
        ...c,
        pricing: {
          ...c.pricing,
          lineItems: [...c.pricing.lineItems, { product: '', price: 0, quantity: 1, total: 0 }],
        },
      }
    })
  }

  // --- Payment Schedule ---
  function updatePaymentSchedule(i: number, field: keyof PaymentScheduleItem, value: string | number) {
    setContent((c) => {
      if (!c) return c
      const updated = [...c.paymentSchedule]
      updated[i] = { ...updated[i], [field]: value }
      return { ...c, paymentSchedule: updated }
    })
  }

  function removePaymentScheduleItem(i: number) {
    setContent((c) => {
      if (!c || c.paymentSchedule.length <= 1) return c
      return { ...c, paymentSchedule: c.paymentSchedule.filter((_, idx) => idx !== i) }
    })
  }

  function addPaymentScheduleItem() {
    setContent((c) => {
      if (!c) return c
      return { ...c, paymentSchedule: [...c.paymentSchedule, { description: '', date: '', amount: 0 }] }
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setSaving(false)
      return
    }
    router.push(`/proposal-tool/${id}`)
  }

  const lang: ProposalLanguage = content.language ?? 'en'
  const isLocked = translating || saving

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-sm text-neutral-400 hover:text-neutral-700">
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Edit proposal</h1>
      </div>

      <div className="space-y-10">

        {/* Language toggle */}
        <section>
          <Label className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-3 block">
            Language
          </Label>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50">
              {(['en', 'fr'] as ProposalLanguage[]).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLanguageChange(l)}
                  disabled={isLocked}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all disabled:cursor-wait ${
                    lang === l
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {l === 'en' ? 'English' : 'Français'}
                </button>
              ))}
            </div>
            {translating && (
              <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3 text-neutral-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Translating…
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-2">Translates all content and switches document labels.</p>
        </section>

        {/* Introduction */}
        <section>
          <Label className="text-xs uppercase tracking-widest text-neutral-400 font-semibold">
            Introduction
          </Label>
          <Textarea
            className="mt-2 resize-none"
            rows={4}
            disabled={isLocked}
            value={content.introduction ?? ''}
            onChange={(e) => setContent({ ...content, introduction: e.target.value })}
          />
        </section>

        {/* Scope of Work */}
        <section>
          <Label className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-3 block">
            Scope of Work
          </Label>
          <div className="space-y-2">
            {content.challenges.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <Input
                    placeholder="Challenge"
                    value={item.challenge}
                    disabled={isLocked}
                    onChange={(e) => updateChallenge(i, 'challenge', e.target.value)}
                  />
                  <Input
                    placeholder="Deliverable"
                    value={item.deliverable}
                    disabled={isLocked}
                    onChange={(e) => updateChallenge(i, 'deliverable', e.target.value)}
                  />
                </div>
                <button
                  onClick={() => removeChallenge(i)}
                  disabled={isLocked}
                  className="text-neutral-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Remove row"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addChallenge}
            disabled={isLocked}
            className="mt-3 text-xs text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-40"
          >
            + Add row
          </button>
        </section>

        {/* Pricing */}
        <section>
          <Label className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-3 block">
            Pricing
          </Label>
          <div className="space-y-2">
            {content.pricing.lineItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="grid grid-cols-4 gap-2 flex-1">
                  <Input
                    className="col-span-2"
                    placeholder="Service"
                    value={item.product}
                    disabled={isLocked}
                    onChange={(e) => updateLineItem(i, 'product', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={item.price}
                    disabled={isLocked}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0
                      updateLineItem(i, 'price', p)
                      updateLineItem(i, 'total', p * item.quantity)
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    disabled={isLocked}
                    onChange={(e) => {
                      const q = parseFloat(e.target.value) || 1
                      updateLineItem(i, 'quantity', q)
                      updateLineItem(i, 'total', item.price * q)
                    }}
                  />
                </div>
                <button
                  onClick={() => removeLineItem(i)}
                  disabled={isLocked || content.pricing.lineItems.length <= 1}
                  className="text-neutral-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Remove row"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addLineItem}
            disabled={isLocked}
            className="mt-3 text-xs text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-40"
          >
            + Add row
          </button>
        </section>

        {/* Payment Schedule */}
        <section>
          <Label className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-3 block">
            Payment Schedule
          </Label>
          <div className="space-y-2">
            {content.paymentSchedule.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <Input
                    placeholder="Description"
                    value={item.description}
                    disabled={isLocked}
                    onChange={(e) => updatePaymentSchedule(i, 'description', e.target.value)}
                  />
                  <Input
                    placeholder="Due date"
                    value={item.date}
                    disabled={isLocked}
                    onChange={(e) => updatePaymentSchedule(i, 'date', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    disabled={isLocked}
                    onChange={(e) => updatePaymentSchedule(i, 'amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <button
                  onClick={() => removePaymentScheduleItem(i)}
                  disabled={isLocked || content.paymentSchedule.length <= 1}
                  className="text-neutral-300 hover:text-red-400 transition-colors shrink-0 text-lg leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Remove row"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addPaymentScheduleItem}
            disabled={isLocked}
            className="mt-3 text-xs text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-40"
          >
            + Add row
          </button>
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pb-12">
          <Button onClick={handleSave} disabled={isLocked}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={() => router.back()} disabled={isLocked}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
