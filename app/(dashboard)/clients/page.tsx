import { getAllClients } from '@/lib/clients'
import ClientsManager from './ClientsManager'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const clients = await getAllClients()
  return <ClientsManager clients={clients} />
}
