import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

const KICKOFF_URL = 'https://calendly.com/clement-guiraudpro/30min'

export async function sendProposalSignedEmail(params: {
  ownerEmail: string
  ownerName: string
  clientName: string
  clientCompany: string
  proposalTitle: string
  proposalUrl: string
}) {
  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.ownerEmail,
    subject: `✍️ ${params.clientName} signed "${params.proposalTitle}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Proposal Signed</h1>
        <p style="color: #666; margin-bottom: 24px;">${params.clientName} from ${params.clientCompany} has signed your proposal.</p>
        <a href="${params.proposalUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View Proposal</a>
        <p style="margin-top: 32px; font-size: 14px; color: #999;">They have been directed to complete payment via Stripe.</p>
      </div>
    `,
  })
}

export async function sendProposalToClientEmail(params: {
  clientEmail: string
  clientName: string
  clientCompany: string
  proposalTitle: string
  proposalUrl: string
  ownerName: string
}) {
  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.clientEmail,
    subject: `Your proposal — ${params.proposalTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Hi ${params.clientName},</h1>
        <p style="color: #444; line-height: 1.6; margin-bottom: 16px;">
          Following our discussion, I'm pleased to share the proposal we agreed upon for <strong>${params.clientCompany}</strong>.
        </p>
        <p style="color: #444; line-height: 1.6; margin-bottom: 24px;">
          You can review all the details, sign, and proceed with payment directly from the link below:
        </p>
        <a href="${params.proposalUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View & sign proposal</a>
        <p style="margin-top: 32px; color: #666; line-height: 1.6;">
          Don't hesitate to reach out if you have any questions.<br/>
          Looking forward to working with you.
        </p>
        <p style="color: #666;">${params.ownerName}</p>
      </div>
    `,
  })
}

export async function sendProposalPaidEmail(params: {
  ownerEmail: string
  clientEmail: string
  clientName: string
  clientCompany: string
  proposalTitle: string
  proposalUrl: string
  amount: number
  currency: string
  pdfBuffer: Buffer
}) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: params.currency.toUpperCase(),
  }).format(params.amount)

  const pdfAttachment = {
    filename: `${params.proposalTitle.replace(/[^a-z0-9]/gi, '-')}.pdf`,
    content: params.pdfBuffer.toString('base64'),
    type: 'application/pdf',
  }

  // Notify owner
  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.ownerEmail,
    subject: `💰 Payment received for "${params.proposalTitle}"`,
    attachments: [pdfAttachment],
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Payment Received</h1>
        <p style="color: #666; margin-bottom: 8px;">${params.clientName} from ${params.clientCompany} has paid <strong>${formatted}</strong>.</p>
        <p style="color: #666; margin-bottom: 24px;">The signed proposal is attached as a PDF.</p>
        <a href="${params.proposalUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View Proposal</a>
      </div>
    `,
  })

  // Confirm to client with PDF + kickoff link
  await getResend().emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: params.clientEmail,
    subject: `Payment confirmed — ${params.proposalTitle}`,
    attachments: [pdfAttachment],
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Payment Confirmed</h1>
        <p style="color: #666; margin-bottom: 4px;">Thank you, ${params.clientName}. Your payment of <strong>${formatted}</strong> has been received.</p>
        <p style="color: #666; margin-bottom: 28px;">Your signed proposal is attached to this email as a PDF.</p>

        <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #166534; margin: 0 0 8px;">What's next — book your kickoff call</h2>
          <p style="color: #166534; font-size: 14px; margin: 0 0 16px;">Let's schedule a call to kick things off and align on next steps.</p>
          <a href="${KICKOFF_URL}" style="display: inline-block; background: #166534; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Book your kickoff call →</a>
        </div>

        <a href="${params.proposalUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View proposal online</a>
      </div>
    `,
  })
}
