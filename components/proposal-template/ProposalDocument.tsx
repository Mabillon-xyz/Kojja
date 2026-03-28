import { Proposal, ProposalLanguage } from '@/types/proposal'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ProposalDocumentProps {
  proposal: Proposal
}

const LABELS = {
  en: {
    tag: 'Sales Proposal',
    totalInvestment: 'Total investment',
    validUntil: 'Valid until',
    introduction: 'Introduction',
    scopeOfWork: 'Scope of Work',
    challenge: 'Challenge',
    deliverable: 'Deliverable',
    investment: 'Investment',
    service: 'Service',
    price: 'Price',
    qty: 'Qty',
    total: 'Total',
    paymentSchedule: 'Payment Schedule',
    milestone: 'Milestone',
    due: 'Due',
    amount: 'Amount',
    approval: 'Approval & Signature',
    approvalText: 'By signing below, both parties agree to the terms and scope outlined in this proposal.',
    authorizedBy: 'Authorized by',
    acceptedBy: 'Accepted by',
    preparedFor: 'Prepared for',
    signature: 'Signature',
  },
  fr: {
    tag: 'Proposition commerciale',
    totalInvestment: 'Investissement total',
    validUntil: 'Valide jusqu\'au',
    introduction: 'Introduction',
    scopeOfWork: 'Périmètre de mission',
    challenge: 'Besoin',
    deliverable: 'Livrable',
    investment: 'Investissement',
    service: 'Prestation',
    price: 'Prix',
    qty: 'Qté',
    total: 'Total',
    paymentSchedule: 'Calendrier de paiement',
    milestone: 'Étape',
    due: 'Échéance',
    amount: 'Montant',
    approval: 'Approbation & Signature',
    approvalText: 'En signant ci-dessous, les deux parties acceptent les conditions décrites dans cette proposition.',
    authorizedBy: 'Autorisé par',
    acceptedBy: 'Accepté par',
    preparedFor: 'Préparé pour',
    signature: 'Signature',
  },
}

export default function ProposalDocument({ proposal }: ProposalDocumentProps) {
  const content = proposal.content
  if (!content) return null

  const lang: ProposalLanguage = content.language ?? 'en'
  const L = LABELS[lang]
  const totalFormatted = formatCurrency(proposal.price, proposal.currency)

  // Backward compat: use introduction if present, else fall back to executiveSummary
  const introText = content.introduction ?? content.executiveSummary ?? ''

  return (
    <div
      id="proposal-document"
      className="bg-white max-w-3xl mx-auto"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif' }}
    >
      {/* Header */}
      <div className="px-12 pt-14 pb-10 border-b border-neutral-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">
              {L.tag}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900 leading-tight">
              {proposal.client_company}
            </h1>
            <p className="text-lg text-neutral-500 mt-2">{proposal.title}</p>
          </div>
          <div className="text-right ml-8 shrink-0">
            <p className="text-3xl font-bold text-neutral-900">{totalFormatted}</p>
            <p className="text-sm text-neutral-400 mt-1">{L.totalInvestment}</p>
            {proposal.expires_at && (
              <p className="text-xs text-neutral-400 mt-2">
                {L.validUntil} {formatDate(proposal.expires_at)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Introduction */}
      {introText && (
        <div className="px-12 py-8 border-b border-neutral-100">
          <SectionLabel>{L.introduction}</SectionLabel>
          <p className="text-sm text-neutral-600 leading-relaxed mt-3">
            {introText}
          </p>
        </div>
      )}

      {/* Scope of Work */}
      <div className="px-12 py-8 border-b border-neutral-100">
        <SectionLabel>{L.scopeOfWork}</SectionLabel>
        <div className="mt-4 rounded-xl overflow-hidden border border-neutral-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="text-left font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3 w-1/2">
                  {L.challenge}
                </th>
                <th className="text-left font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3 w-1/2">
                  {L.deliverable}
                </th>
              </tr>
            </thead>
            <tbody>
              {content.challenges.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}>
                  <td className="px-5 py-3 text-neutral-700 align-top">{item.challenge}</td>
                  <td className="px-5 py-3 text-neutral-700 align-top">{item.deliverable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investment */}
      <div className="px-12 py-8 border-b border-neutral-100">
        <SectionLabel>{L.investment}</SectionLabel>
        <div className="mt-4 rounded-xl overflow-hidden border border-neutral-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="text-left font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3">
                  {L.service}
                </th>
                <th className="text-right font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3">
                  {L.price}
                </th>
                <th className="text-right font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3">
                  {L.qty}
                </th>
                <th className="text-right font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3">
                  {L.total}
                </th>
              </tr>
            </thead>
            <tbody>
              {content.pricing.lineItems.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}>
                  <td className="px-5 py-3 text-neutral-700">{item.product}</td>
                  <td className="px-5 py-3 text-neutral-500 text-right">
                    {formatCurrency(item.price, proposal.currency)}
                  </td>
                  <td className="px-5 py-3 text-neutral-500 text-right">{item.quantity}</td>
                  <td className="px-5 py-3 text-neutral-700 font-medium text-right">
                    {formatCurrency(item.total, proposal.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {content.pricing.tax !== undefined && (
                <tr className="border-t border-neutral-100">
                  <td colSpan={3} className="px-5 py-3 text-right text-sm text-neutral-500">
                    Subtotal
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-neutral-700 font-medium">
                    {formatCurrency(content.pricing.subtotal, proposal.currency)}
                  </td>
                </tr>
              )}
              <tr className="bg-neutral-900">
                <td colSpan={3} className="px-5 py-4 text-right text-sm font-semibold text-white">
                  {L.total}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-white">
                  {formatCurrency(content.pricing.total, proposal.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Payment Schedule */}
      <div className="px-12 py-8 border-b border-neutral-100">
        <SectionLabel>{L.paymentSchedule}</SectionLabel>
        <div className="mt-4 rounded-xl overflow-hidden border border-neutral-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="text-left font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3">
                  {L.milestone}
                </th>
                <th className="text-left font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3">
                  {L.due}
                </th>
                <th className="text-right font-semibold text-neutral-400 uppercase tracking-wide text-xs px-5 py-3">
                  {L.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {content.paymentSchedule.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}>
                  <td className="px-5 py-3 text-neutral-700">{item.description}</td>
                  <td className="px-5 py-3 text-neutral-500">{item.date}</td>
                  <td className="px-5 py-3 text-neutral-700 font-medium text-right">
                    {formatCurrency(item.amount, proposal.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signature */}
      <div className="px-12 py-8">
        <SectionLabel>{L.approval}</SectionLabel>
        <p className="text-xs text-neutral-400 mt-3 max-w-lg">{L.approvalText}</p>

        <div className="mt-8 grid grid-cols-2 gap-8">
          {/* Sender */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              {L.authorizedBy}
            </p>
            <div className="border-b border-neutral-200 pb-2 min-h-[48px]" />
            <p className="text-xs text-neutral-400 mt-2">{L.signature}</p>
          </div>

          {/* Client */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">
              {L.acceptedBy} {proposal.client_company}
            </p>
            {proposal.signature_data ? (
              <div className="border-b border-neutral-200 pb-2 min-h-[48px] flex items-end">
                {proposal.signature_data.startsWith('data:image') ? (
                  <img
                    src={proposal.signature_data}
                    alt="Client signature"
                    className="max-h-12 object-contain"
                  />
                ) : (
                  <span className="font-signature text-3xl text-neutral-800">
                    {proposal.signature_data}
                  </span>
                )}
              </div>
            ) : (
              <div className="border-b border-neutral-200 pb-2 min-h-[48px]" />
            )}
            <p className="text-xs text-neutral-400 mt-2">{L.signature}</p>
            {proposal.signer_name && (
              <p className="text-sm font-medium text-neutral-700 mt-1">{proposal.signer_name}</p>
            )}
            {proposal.signed_at && (
              <p className="text-xs text-neutral-400 mt-0.5">{formatDate(proposal.signed_at)}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-neutral-100 flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            {L.preparedFor} {proposal.client_name} · {proposal.client_company}
          </p>
          <p className="text-xs text-neutral-400">
            {formatDate(proposal.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
      {children}
    </p>
  )
}
