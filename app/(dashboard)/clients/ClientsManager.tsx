'use client'

import { useState, useTransition } from 'react'
import { UserPlus, RefreshCw, Trash2, Eye, EyeOff, Copy, Check } from 'lucide-react'
import type { ClientRow } from '@/lib/clients'
import { createClientAction, deleteClientAction, syncClientCampaignsAction } from './actions'

const LOGIN_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kojja.vercel.app'

function maskKey(key: string) {
  return key.slice(0, 6) + '••••••••' + key.slice(-4)
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'à l\'instant'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  return `il y a ${Math.floor(diff / 86400)}j`
}

function ClientRow({ client, onDelete }: { client: ClientRow; onDelete: () => void }) {
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [syncing, startSync] = useTransition()
  const [deleting, startDelete] = useTransition()
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  function copyLink() {
    navigator.clipboard.writeText(LOGIN_URL + '/login')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSync() {
    setSyncMsg(null)
    startSync(async () => {
      const res = await syncClientCampaignsAction(client.id)
      setSyncMsg(res.error ? `Erreur : ${res.error}` : `${res.synced ?? 0} campagnes synchronisées`)
    })
  }

  function handleDelete() {
    if (!confirm(`Supprimer le compte de ${client.name} ? Cette action est irréversible.`)) return
    startDelete(async () => {
      await deleteClientAction(client.id)
      onDelete()
    })
  }

  return (
    <tr className="hover:bg-neutral-50 transition-colors">
      <td className="px-5 py-3.5">
        <p className="font-medium text-neutral-900 text-sm">{client.name}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{client.email}</p>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <code className="text-xs text-neutral-600 font-mono">
            {showKey ? client.lemlist_api_key : maskKey(client.lemlist_api_key)}
          </code>
          <button
            onClick={() => setShowKey(v => !v)}
            className="text-neutral-300 hover:text-neutral-500 transition-colors"
            title={showKey ? 'Masquer' : 'Afficher'}
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </td>
      <td className="px-4 py-3.5 text-xs text-neutral-400">{timeAgo(client.created_at)}</td>
      <td className="px-4 py-3.5">
        {syncMsg && (
          <p className={`text-xs mb-1 ${syncMsg.startsWith('Erreur') ? 'text-red-500' : 'text-emerald-600'}`}>
            {syncMsg}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 text-neutral-500 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sync…' : 'Sync'}
          </button>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            title="Copier le lien de connexion"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-neutral-500" />}
            {copied ? 'Copié' : 'Lien'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-neutral-300 hover:text-red-500 disabled:opacity-50 transition-colors rounded-lg hover:bg-red-50"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function ClientsManager({ clients: initial }: { clients: ClientRow[] }) {
  const [clients, setClients] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [creating, startCreate] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', email: '', password: '', lemlistApiKey: '' })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setCreated(null)
    startCreate(async () => {
      const res = await createClientAction(form)
      if (res.error) {
        setFormError(res.error)
        return
      }
      setCreated(form.email)
      setForm({ name: '', email: '', password: '', lemlistApiKey: '' })
      setShowForm(false)
      // Refresh list (revalidatePath handles server-side, but we need a client-side refresh)
      // Simple: reload the page data by adding the new entry optimistically
      window.location.reload()
    })
  }

  function handleDelete(id: string) {
    setClients(c => c.filter(cl => cl.id !== id))
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Clients</h1>
          <p className="text-sm text-neutral-400 mt-0.5">{clients.length} compte{clients.length !== 1 ? 's' : ''} actif{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormError(null); setCreated(null) }}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un client
        </button>
      </div>

      {/* Success message */}
      {created && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700">
          Compte créé pour <strong>{created}</strong>. Partagez ce lien de connexion : <code className="text-emerald-800 font-mono">{LOGIN_URL}/login</code>
        </div>
      )}

      {/* Add client form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-neutral-700">Nouveau client</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Nom complet</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={set('name')}
                placeholder="Sophie Martin"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={set('email')}
                placeholder="sophie@exemple.fr"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Mot de passe initial</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={set('password')}
                placeholder="8 caractères minimum"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Clé API Lemlist</label>
              <input
                type="text"
                required
                value={form.lemlistApiKey}
                onChange={set('lemlistApiKey')}
                placeholder="Clé API du compte Lemlist du client"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>
          </div>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3.5 py-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {creating ? 'Création…' : 'Créer le compte'}
            </button>
          </div>
        </form>
      )}

      {/* Clients table */}
      {clients.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <p className="text-sm text-neutral-400">Aucun client pour l'instant. Ajoutez votre premier client ci-dessus.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Clé API Lemlist</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Créé</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {clients.map(client => (
                <ClientRow key={client.id} client={client} onDelete={() => handleDelete(client.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
