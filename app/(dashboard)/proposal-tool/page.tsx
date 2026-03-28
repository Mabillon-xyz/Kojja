import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProposalTable from '@/components/dashboard/ProposalTable'
import { Proposal } from '@/types/proposal'
import { formatCurrency } from '@/lib/utils'

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'bg-[#5865f2] border-[#5865f2]' : 'bg-muted border-border'}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </p>
      <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-white' : 'text-foreground'}`}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1.5 text-muted-foreground">{sub}</p>
      )}
    </div>
  )
}

const STATUS_VERB: Record<string, string> = {
  draft: 'Created',
  sent: 'Sent to client',
  signed: 'Signed',
  paid: 'Payment received',
  expired: 'Expired',
}

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-neutral-300',
  sent: 'bg-blue-400',
  signed: 'bg-amber-400',
  paid: 'bg-green-500',
  expired: 'bg-red-400',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: proposals } = await supabase
    .from('proposals')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  // Auto-expire on read
  const now = new Date().toISOString()
  const toExpire = (proposals ?? []).filter(
    (p) => p.expires_at && p.expires_at < now && p.status !== 'expired' && p.status !== 'paid'
  )
  if (toExpire.length > 0) {
    await supabase
      .from('proposals')
      .update({ status: 'expired' })
      .in('id', toExpire.map((p) => p.id))
  }

  const all = (proposals ?? []).map((p) =>
    toExpire.find((e) => e.id === p.id) ? { ...p, status: 'expired' } : p
  ) as Proposal[]

  const paid = all.filter((p) => p.status === 'paid')
  const pending = all.filter((p) => ['sent', 'signed'].includes(p.status))
  const draft = all.filter((p) => p.status === 'draft')
  const expired = all.filter((p) => p.status === 'expired')
  const signed = all.filter((p) => p.status === 'signed')

  const totalRevenue = paid.reduce((s, p) => s + Number(p.price), 0)
  const pipelineValue = pending.reduce((s, p) => s + Number(p.price), 0)
  const avgDeal = paid.length > 0 ? totalRevenue / paid.length : 0
  const conversionRate = all.length > 0 ? Math.round((paid.length / all.length) * 100) : 0

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const thisMonth = paid.filter((p) => p.paid_at && new Date(p.paid_at) >= monthStart)
  const thisMonthRevenue = thisMonth.reduce((s, p) => s + Number(p.price), 0)

  const recent = [...all]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)

  return (
    <div className="px-4 py-5 md:px-8 md:py-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">📝 Proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {all.length} proposal{all.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link href="/proposal-tool/new" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-all hover:opacity-90">
          New proposal
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency(totalRevenue)}
          sub={`${paid.length} paid proposal${paid.length !== 1 ? 's' : ''}`}
          accent
        />
        <StatCard
          label="Pipeline"
          value={formatCurrency(pipelineValue)}
          sub={`${pending.length} awaiting payment`}
        />
        <StatCard
          label="This month"
          value={formatCurrency(thisMonthRevenue)}
          sub={`${thisMonth.length} closed`}
        />
        <StatCard
          label="Conversion rate"
          value={`${conversionRate}%`}
          sub={avgDeal > 0 ? `Avg deal ${formatCurrency(avgDeal)}` : 'No closed deals yet'}
        />
      </div>

      {/* Status breakdown + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Breakdown */}
        <div className="bg-muted rounded-xl border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
            📊 By status
          </p>
          <div className="space-y-3.5">
            {[
              { label: 'Draft',   count: draft.length,   dot: STATUS_DOT.draft },
              { label: 'Sent',    count: all.filter(p => p.status === 'sent').length, dot: STATUS_DOT.sent },
              { label: 'Signed',  count: signed.length,  dot: STATUS_DOT.signed },
              { label: 'Paid',    count: paid.length,    dot: STATUS_DOT.paid },
              { label: 'Expired', count: expired.length, dot: STATUS_DOT.expired },
            ].map(({ label, count, dot }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <span className="text-sm text-foreground/70">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-border rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${dot}`}
                      style={{ width: all.length > 0 ? `${(count / all.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-4 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 bg-muted rounded-xl border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            🕐 Recent activity
          </p>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No proposals yet — create your first one.
            </p>
          ) : (
            <div>
              {recent.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-start gap-3 py-3 ${i < recent.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${STATUS_DOT[p.status]}`} />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/proposal-tool/${p.id}`}
                      className="text-sm font-medium text-foreground hover:underline truncate block"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {STATUS_VERB[p.status]} · {p.client_company}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-foreground/70 shrink-0">
                    {formatCurrency(Number(p.price), p.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All proposals table */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          📋 All proposals
        </p>
        <ProposalTable proposals={all} />
      </div>
    </div>
  )
}
