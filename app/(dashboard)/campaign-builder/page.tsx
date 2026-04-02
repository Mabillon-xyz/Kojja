'use client'

import { useState, useEffect, useRef } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────
type Lead = { id: string; first_name: string; last_name: string; company_name: string | null }
type Email = { subject: string; body: string }
type CampaignKit = {
  icp: string
  okrs: string[]
  hooks: string[]
  linkedin: string[]
  emails: Email[]
}

// ── Progress overlay ───────────────────────────────────────────────
const STEPS = [
  { at: 0,  label: 'Analyzing coach profile…' },
  { at: 4,  label: 'Defining ICP and target audience…' },
  { at: 8,  label: 'Writing OKRs…' },
  { at: 12, label: 'Crafting personalization hooks…' },
  { at: 16, label: 'Writing LinkedIn messages…' },
  { at: 20, label: 'Writing email sequences…' },
  { at: 24, label: 'Finalizing campaign kit…' },
]

function getProgress(elapsed: number): number {
  const t = Math.min(elapsed / 28, 1)
  return 88 * (1 - Math.pow(1 - t, 2.5))
}

function GeneratingOverlay({ elapsed }: { elapsed: number }) {
  const progress = getProgress(elapsed)
  const step = [...STEPS].reverse().find((s) => elapsed >= s.at) ?? STEPS[0]
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full max-w-sm px-8 text-center">
        <div className="relative w-16 h-16 mx-auto mb-8">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28"
              fill="none" stroke="var(--color-foreground)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>
        <h2 className="text-base font-semibold text-foreground mb-2">Generating campaign kit</h2>
        <p className="text-sm text-muted-foreground mb-6 min-h-[20px] transition-all duration-500">{step.label}</p>
        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden mb-4">
          <div className="h-full bg-foreground rounded-full" style={{ width: `${progress}%`, transition: 'width 0.8s ease' }} />
        </div>
        <p className="text-xs text-muted-foreground/70">{timeStr} elapsed · usually 15–25s</p>
      </div>
    </div>
  )
}

// ── Copy button ────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

// ── Section card ───────────────────────────────────────────────────
function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center gap-2">
        <span>{emoji}</span>
        <span className="text-sm font-semibold text-neutral-800">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────
export default function CampaignBuilderPage() {
  const [form, setForm] = useState({
    coachName: '',
    coachSpecialty: '',
    targetAudience: '',
    clientPainPoints: '',
    results: '',
    context: '',
  })
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [kit, setKit] = useState<CampaignKit | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function pickLead(id: string) {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ')
    const company = lead.company_name ? ` — ${lead.company_name}` : ''
    set('coachName', `${name}${company}`)
  }

  // Fetch leads on mount
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('leads')
      .select('id, first_name, last_name, company_name')
      .neq('stage', 'not_interested')
      .order('first_name')
      .then(({ data }) => { if (data) setLeads(data) })
  }, [])

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
    setKit(null)
    setLoading(true)
    try {
      const res = await fetch('/api/campaign-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setKit(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
    setLoading(false)
  }

  const hasRequired = form.coachName && form.coachSpecialty && form.targetAudience &&
    form.clientPainPoints && form.results

  return (
    <>
      {loading && <GeneratingOverlay elapsed={elapsed} />}

      <div className="max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">🎯 Campaign Builder</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Fill in the coach profile → get a complete Lemlist campaign kit instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">

          {/* ── Left: Form ── */}
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-700">👤 Coach profile</h2>

              {leads.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="leadPick">Pick from your leads</Label>
                  <select
                    id="leadPick"
                    defaultValue=""
                    onChange={(e) => pickLead(e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                  >
                    <option value="" disabled>— Select a lead —</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.first_name} {l.last_name}{l.company_name ? ` — ${l.company_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="coachName">Coach / Company name *</Label>
                <Input
                  id="coachName"
                  placeholder="Marie Leblanc – Coaching Dirigeants"
                  value={form.coachName}
                  onChange={(e) => set('coachName', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coachSpecialty">Coaching specialty *</Label>
                <Input
                  id="coachSpecialty"
                  placeholder="Executive coaching, life coaching, business coaching…"
                  value={form.coachSpecialty}
                  onChange={(e) => set('coachSpecialty', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="targetAudience">Target audience *</Label>
                <Input
                  id="targetAudience"
                  placeholder="CEOs of SMEs, freelancers in transition, sales managers…"
                  value={form.targetAudience}
                  onChange={(e) => set('targetAudience', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-700">💡 Value proposition</h2>

              <div className="space-y-1.5">
                <Label htmlFor="clientPainPoints">Pain points addressed *</Label>
                <Textarea
                  id="clientPainPoints"
                  placeholder="Overwhelmed by decisions, lack of clarity on priorities, difficulty delegating…"
                  value={form.clientPainPoints}
                  onChange={(e) => set('clientPainPoints', e.target.value)}
                  required
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="results">Concrete results / proof points *</Label>
                <Textarea
                  id="results"
                  placeholder="+40% revenue in 6 months, client promoted to VP in 3 months, 3 new clients per week…"
                  value={form.results}
                  onChange={(e) => set('results', e.target.value)}
                  required
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="context">
                  Additional context{' '}
                  <span className="text-neutral-400 font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="context"
                  placeholder="Methodology, certifications, tone of voice, target geography…"
                  value={form.context}
                  onChange={(e) => set('context', e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" disabled={loading || !hasRequired} className="w-full" size="lg">
              {loading ? (
                <><Loader2 size={16} className="animate-spin mr-2" /> Generating…</>
              ) : (
                '✨ Generate campaign kit'
              )}
            </Button>
          </form>

          {/* ── Right: Output ── */}
          <div className="space-y-4">
            {!kit ? (
              <div className="bg-white border border-neutral-200 border-dashed rounded-2xl p-12 text-center">
                <p className="text-3xl mb-3">🎯</p>
                <p className="text-sm font-medium text-neutral-600">Your campaign kit will appear here</p>
                <p className="text-xs text-neutral-400 mt-1">Fill in the form and click Generate</p>
              </div>
            ) : (
              <>
                {/* ICP */}
                <Section emoji="🎯" title="ICP — Ideal Client Profile">
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-neutral-700 leading-relaxed flex-1">{kit.icp}</p>
                    <CopyBtn text={kit.icp} />
                  </div>
                </Section>

                {/* OKRs */}
                <Section emoji="📈" title="OKRs — Résultats clés">
                  <ul className="space-y-2">
                    {kit.okrs.map((okr, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-500 flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-neutral-700 flex-1">{okr}</span>
                        <CopyBtn text={okr} />
                      </li>
                    ))}
                  </ul>
                </Section>

                {/* Hooks */}
                <Section emoji="🪝" title="Accroches de personnalisation">
                  <div className="space-y-3">
                    {kit.hooks.map((hook, i) => (
                      <div key={i} className="flex items-start gap-2 bg-neutral-50 rounded-xl px-4 py-3">
                        <span className="text-xs font-bold text-neutral-400 mt-0.5 w-4 flex-shrink-0">{i + 1}</span>
                        <p className="text-sm text-neutral-700 flex-1 leading-relaxed">{hook}</p>
                        <CopyBtn text={hook} />
                      </div>
                    ))}
                  </div>
                </Section>

                {/* LinkedIn */}
                <Section emoji="💼" title="Messages LinkedIn">
                  <div className="space-y-3">
                    {kit.linkedin.map((msg, i) => (
                      <div key={i} className="border border-neutral-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                            Message {i + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              msg.length > 280 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                            }`}>
                              {msg.length} chars
                            </span>
                            <CopyBtn text={msg} />
                          </div>
                        </div>
                        <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{msg}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Emails */}
                <Section emoji="📧" title="Séquence email">
                  <div className="space-y-4">
                    {kit.emails.map((email, i) => (
                      <div key={i} className="border border-neutral-200 rounded-xl overflow-hidden">
                        <div className="bg-neutral-50 px-4 py-2.5 flex items-center justify-between border-b border-neutral-200">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex-shrink-0">
                              Email {i + 1}
                            </span>
                            <span className="text-xs text-neutral-600 font-medium truncate">· {email.subject}</span>
                          </div>
                          <CopyBtn text={`Objet : ${email.subject}\n\n${email.body}`} />
                        </div>
                        <div className="p-4">
                          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">Objet</p>
                          <p className="text-sm text-neutral-800 font-medium mb-3">{email.subject}</p>
                          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">Corps</p>
                          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{email.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
