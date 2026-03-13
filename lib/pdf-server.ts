import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import { createElement } from 'react'
import { Proposal } from '@/types/proposal'

const KICKOFF_URL = 'https://calendly.com/clement-guiraudpro/30min'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    lineHeight: 1.5,
  },
  // Header
  header: { marginBottom: 28, borderBottomWidth: 1, borderBottomColor: '#e5e5e5', paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9ca3af', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  h1: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#6b7280' },
  priceValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#111', textAlign: 'right' },
  priceLabel: { fontSize: 8, color: '#9ca3af', textAlign: 'right', marginTop: 2 },
  // Sections
  section: { marginBottom: 24 },
  twoCol: { flexDirection: 'row', gap: 24, marginBottom: 24 },
  col: { flex: 1 },
  body: { fontSize: 9, color: '#4b5563', lineHeight: 1.6 },
  // Tables
  table: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 4, overflow: 'hidden', marginTop: 8 },
  thead: { flexDirection: 'row', backgroundColor: '#f9fafb' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', padding: '6 8', flex: 1 },
  thRight: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', padding: '6 8', flex: 1, textAlign: 'right' },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  trAlt: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fafafa' },
  td: { fontSize: 9, color: '#374151', padding: '7 8', flex: 1 },
  tdRight: { fontSize: 9, color: '#374151', padding: '7 8', flex: 1, textAlign: 'right' },
  tdBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', padding: '7 8', flex: 1 },
  totalRow: { flexDirection: 'row', backgroundColor: '#111' },
  totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff', padding: '8 8', flex: 3, textAlign: 'right' },
  totalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff', padding: '8 8', flex: 1, textAlign: 'right' },
  // Approval
  sigRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  sigBox: { flex: 1 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: '#d1d5db', height: 40, marginBottom: 4 },
  sigName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  sigDate: { fontSize: 8, color: '#9ca3af' },
  // Kickoff
  kickoff: { marginTop: 28, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 16 },
  kickoffTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#166534', marginBottom: 4 },
  kickoffBody: { fontSize: 9, color: '#166534', marginBottom: 10 },
  kickoffLink: { fontSize: 9, color: '#166534', fontFamily: 'Helvetica-Bold', textDecoration: 'underline' },
  // Footer
  footer: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#9ca3af' },
})

function fmt(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export async function generateProposalPdf(proposal: Proposal): Promise<Buffer> {
  const c = proposal.content!

  const doc = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: s.page },

      // Header
      createElement(View, { style: s.header },
        createElement(View, { style: s.headerRow },
          createElement(View, { style: { flex: 1 } },
            createElement(Text, { style: s.label }, 'Sales Proposal'),
            createElement(Text, { style: s.h1 }, proposal.client_company),
            createElement(Text, { style: s.subtitle }, proposal.title),
          ),
          createElement(View, { style: { alignItems: 'flex-end' } },
            createElement(Text, { style: s.priceValue }, fmt(proposal.price, proposal.currency)),
            createElement(Text, { style: s.priceLabel }, 'Total investment'),
            proposal.expires_at
              ? createElement(Text, { style: { ...s.priceLabel, marginTop: 4 } }, `Valid until ${fmtDate(proposal.expires_at)}`)
              : null,
          ),
        )
      ),

      // Executive Summary + Approach
      createElement(View, { style: s.twoCol },
        createElement(View, { style: s.col },
          createElement(Text, { style: s.label }, 'Executive Summary'),
          createElement(Text, { style: { ...s.body, marginTop: 4 } }, c.executiveSummary),
        ),
        createElement(View, { style: s.col },
          createElement(Text, { style: s.label }, 'Our Approach'),
          createElement(Text, { style: { ...s.body, marginTop: 4 } }, c.approach),
        ),
      ),

      // Scope of Work
      createElement(View, { style: s.section },
        createElement(Text, { style: s.label }, 'Scope of Work'),
        createElement(View, { style: s.table },
          createElement(View, { style: s.thead },
            createElement(Text, { style: s.th }, 'Challenge'),
            createElement(Text, { style: s.th }, 'Deliverable'),
          ),
          ...c.challenges.map((item, i) =>
            createElement(View, { style: i % 2 === 0 ? s.tr : s.trAlt, key: i },
              createElement(Text, { style: s.td }, item.challenge),
              createElement(Text, { style: s.td }, item.deliverable),
            )
          ),
        ),
      ),

      // Pricing
      createElement(View, { style: s.section },
        createElement(Text, { style: s.label }, 'Investment'),
        createElement(View, { style: s.table },
          createElement(View, { style: s.thead },
            createElement(Text, { style: { ...s.th, flex: 3 } }, 'Service'),
            createElement(Text, { style: s.thRight }, 'Price'),
            createElement(Text, { style: s.thRight }, 'Qty'),
            createElement(Text, { style: s.thRight }, 'Total'),
          ),
          ...c.pricing.lineItems.map((item, i) =>
            createElement(View, { style: i % 2 === 0 ? s.tr : s.trAlt, key: i },
              createElement(Text, { style: { ...s.td, flex: 3 } }, item.product),
              createElement(Text, { style: s.tdRight }, fmt(item.price, proposal.currency)),
              createElement(Text, { style: s.tdRight }, String(item.quantity)),
              createElement(Text, { style: s.tdRight }, fmt(item.total, proposal.currency)),
            )
          ),
          createElement(View, { style: s.totalRow },
            createElement(Text, { style: { ...s.totalLabel, flex: 6 } }, 'Total'),
            createElement(Text, { style: s.totalValue }, fmt(c.pricing.total, proposal.currency)),
          ),
        ),
      ),

      // Payment Schedule
      createElement(View, { style: s.section },
        createElement(Text, { style: s.label }, 'Payment Schedule'),
        createElement(View, { style: s.table },
          createElement(View, { style: s.thead },
            createElement(Text, { style: { ...s.th, flex: 2 } }, 'Milestone'),
            createElement(Text, { style: s.th }, 'Due'),
            createElement(Text, { style: s.thRight }, 'Amount'),
          ),
          ...c.paymentSchedule.map((item, i) =>
            createElement(View, { style: i % 2 === 0 ? s.tr : s.trAlt, key: i },
              createElement(Text, { style: { ...s.td, flex: 2 } }, item.description),
              createElement(Text, { style: s.td }, item.date),
              createElement(Text, { style: s.tdRight }, fmt(item.amount, proposal.currency)),
            )
          ),
        ),
      ),

      // Approval
      createElement(View, { style: s.section },
        createElement(Text, { style: s.label }, 'Approval & Next Steps'),
        createElement(Text, { style: { ...s.body, marginTop: 4, maxWidth: 400 } }, c.approvalText),
        createElement(View, { style: s.sigRow },
          createElement(View, { style: s.sigBox },
            createElement(View, { style: s.sigLine }),
            createElement(Text, { style: s.sigDate }, 'Authorized by'),
          ),
          createElement(View, { style: s.sigBox },
            createElement(View, { style: s.sigLine }),
            proposal.signer_name
              ? createElement(Text, { style: s.sigName }, proposal.signer_name)
              : null,
            proposal.signed_at
              ? createElement(Text, { style: s.sigDate }, `Signed ${fmtDate(proposal.signed_at)}`)
              : null,
          ),
        ),
      ),

      // Kickoff CTA
      createElement(View, { style: s.kickoff },
        createElement(Text, { style: s.kickoffTitle }, "What's next — book your kickoff call"),
        createElement(Text, { style: s.kickoffBody }, "Your payment has been received. Let's schedule a kickoff call to get things started."),
        createElement(Text, { style: s.kickoffLink }, KICKOFF_URL),
      ),

      // Footer
      createElement(View, { style: s.footer },
        createElement(Text, { style: s.footerText }, `Prepared for ${proposal.client_name} · ${proposal.client_company}`),
        createElement(Text, { style: s.footerText }, fmtDate(proposal.created_at)),
      ),
    )
  )

  return Buffer.from(await renderToBuffer(doc))
}
