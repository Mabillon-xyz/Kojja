export const dynamic = 'force-dynamic'

import { getLinkedInDailySends, type LinkedInDaySend } from '@/lib/lemlist-linkedin'
import LinkedInSendsChart from '@/components/flows/LinkedInSendsChart'

export default async function PipelinePage() {
  const linkedInSends = await getLinkedInDailySends()

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Vue d&apos;ensemble du pipeline Koj²a</p>
      </div>

      <LinkedInSendsChart rows={linkedInSends as LinkedInDaySend[]} />
    </div>
  )
}
