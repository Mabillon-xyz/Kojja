'use client'

import { useState } from 'react'
import { Proposal, ProposalLanguage } from '@/types/proposal'
import ProposalDocument from '@/components/proposal-template/ProposalDocument'
import SignatureModal from '@/components/signature/SignatureModal'
import ConfettiEffect from '@/components/shared/ConfettiEffect'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { exportProposalToPdf } from '@/lib/pdf'

interface PublicProposalClientProps {
  proposal: Proposal
  paymentSuccess: boolean
}

const PUBLIC_LABELS = {
  en: {
    expired: (date: string) => `This proposal expired on ${date}. Please contact the sender for a new one.`,
    paymentConfirmed: 'Payment confirmed — you\'re all set!',
    confirmationSentTo: (email: string) => `A confirmation has been sent to ${email}.`,
    downloadPdf: 'Download PDF',
    exporting: 'Exporting…',
    awaitingPayment: 'This proposal has been signed. Awaiting payment.',
    readyTitle: 'Ready to get started?',
    readyBody: (amount: string) => `Sign this proposal and pay ${amount} to begin.`,
    signAndPay: 'Sign & pay',
    processing: 'Processing…',
  },
  fr: {
    expired: (date: string) => `Cette proposition a expiré le ${date}. Veuillez contacter l'expéditeur pour en obtenir une nouvelle.`,
    paymentConfirmed: 'Paiement confirmé — tout est en ordre !',
    confirmationSentTo: (email: string) => `Une confirmation a été envoyée à ${email}.`,
    downloadPdf: 'Télécharger le PDF',
    exporting: 'Export…',
    awaitingPayment: 'Cette proposition a été signée. En attente du paiement.',
    readyTitle: 'Prêt à démarrer ?',
    readyBody: (amount: string) => `Signez cette proposition et réglez ${amount} pour commencer.`,
    signAndPay: 'Signer & payer',
    processing: 'En cours…',
  },
}

export default function PublicProposalClient({ proposal, paymentSuccess }: PublicProposalClientProps) {
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [signing, setSigning] = useState(false)
  const [localProposal, setLocalProposal] = useState(proposal)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const lang: ProposalLanguage = localProposal.content?.language ?? 'en'
  const L = PUBLIC_LABELS[lang]

  const isExpired = localProposal.status === 'expired'
  const isSigned = ['signed', 'paid'].includes(localProposal.status)
  const isPaid = localProposal.status === 'paid'

  async function handleSign(signerName: string, signatureData: string) {
    setSigning(true)
    setError('')

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: localProposal.slug,
        signerName,
        signatureData,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setSigning(false)
      return
    }

    window.location.href = data.url
  }

  const expiryDate = localProposal.expires_at
    ? new Date(localProposal.expires_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')
    : ''

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4">
      {paymentSuccess && <ConfettiEffect />}

      {/* Expired banner */}
      {isExpired && (
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <p className="text-sm text-red-700">{L.expired(expiryDate)}</p>
          </div>
        </div>
      )}

      {/* Success banner */}
      {(paymentSuccess || isPaid) && (
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">{L.paymentConfirmed}</p>
                <p className="text-xs text-green-600 mt-0.5">{L.confirmationSentTo(localProposal.client_email)}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-green-200 text-green-800 hover:bg-green-100 hover:text-green-900"
              disabled={exporting}
              onClick={async () => {
                setExporting(true)
                await exportProposalToPdf('proposal-document', localProposal.title)
                setExporting(false)
              }}
            >
              {exporting ? L.exporting : L.downloadPdf}
            </Button>
          </div>
        </div>
      )}

      {/* Signed (not yet paid) banner */}
      {isSigned && !isPaid && !paymentSuccess && (
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-4 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">{L.awaitingPayment}</p>
          </div>
        </div>
      )}

      {/* Proposal document */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <ProposalDocument proposal={localProposal} mode="public" />
      </div>

      {/* CTA */}
      {!isExpired && !isSigned && !isPaid && (
        <div className="max-w-3xl mx-auto mt-8">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-900">{L.readyTitle}</p>
              <p className="text-sm text-neutral-500 mt-0.5">
                {L.readyBody(formatCurrency(localProposal.price, localProposal.currency))}
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => setSignModalOpen(true)}
              disabled={signing}
              className="shrink-0"
            >
              {signing ? L.processing : L.signAndPay}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500 mt-3 text-center">{error}</p>}
        </div>
      )}

      <SignatureModal
        open={signModalOpen}
        onClose={() => setSignModalOpen(false)}
        onSign={handleSign}
        clientName={localProposal.client_name}
      />
    </div>
  )
}
