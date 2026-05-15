import { NextRequest, NextResponse } from 'next/server'
import { syncCampaigns } from '@/lib/sync-campaigns'

export async function POST(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET
  if (syncSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const result = await syncCampaigns()

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(result)
}
