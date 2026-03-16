import { readLeads } from '@/lib/read-leads'
import CrmView from '@/components/crm/CrmView'

export default async function CrmPage() {
  const leads = await readLeads()
  return <CrmView leads={leads} />
}
