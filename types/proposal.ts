export type ProposalStatus = 'draft' | 'sent' | 'signed' | 'paid' | 'expired'
export type ProposalLanguage = 'en' | 'fr'

export interface PricingLineItem {
  product: string
  price: number
  quantity: number
  total: number
}

export interface PaymentScheduleItem {
  date: string
  amount: number
  description: string
}

export interface ChallengeItem {
  challenge: string
  deliverable: string
}

export interface ProposalContent {
  language?: ProposalLanguage
  // New merged intro field — falls back to executiveSummary for old proposals
  introduction?: string
  // Legacy fields kept for backward compat
  executiveSummary?: string
  approach?: string
  approvalText?: string
  challenges: ChallengeItem[]
  pricing: {
    lineItems: PricingLineItem[]
    subtotal: number
    tax?: number
    total: number
  }
  paymentSchedule: PaymentScheduleItem[]
}

export interface Proposal {
  id: string
  user_id: string
  slug: string
  title: string
  client_name: string
  client_company: string
  client_email: string
  description: string
  content: ProposalContent | null
  price: number
  currency: string
  status: ProposalStatus
  expires_at: string | null
  stripe_session_id: string | null
  stripe_payment_intent_id: string | null
  signed_at: string | null
  signer_name: string | null
  signature_data: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}
