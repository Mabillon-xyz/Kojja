'use client'
import { useState, useTransition, useRef } from 'react'
import { createLead } from '@/app/actions/leads'

export default function AddLeadForm({ onClose }: { onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createLead(formData)
        formRef.current?.reset()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white dark:bg-card border border-neutral-200 dark:border-border rounded-xl p-5 space-y-4">
      <h3 className="font-medium text-sm text-neutral-900 dark:text-foreground">Add a lead manually</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 dark:text-muted-foreground mb-1">First name *</label>
          <input
            name="first_name"
            required
            placeholder="Claire"
            className="w-full px-3 py-1.5 text-sm bg-transparent dark:bg-muted/30 text-neutral-900 dark:text-foreground placeholder-neutral-400 dark:placeholder-muted-foreground border border-neutral-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 dark:text-muted-foreground mb-1">Last name *</label>
          <input
            name="last_name"
            required
            placeholder="Martin"
            className="w-full px-3 py-1.5 text-sm bg-transparent dark:bg-muted/30 text-neutral-900 dark:text-foreground placeholder-neutral-400 dark:placeholder-muted-foreground border border-neutral-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-foreground"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 dark:text-muted-foreground mb-1">Email *</label>
        <input
          name="email"
          type="email"
          required
          placeholder="claire@cabinet.fr"
          className="w-full px-3 py-1.5 text-sm bg-transparent dark:bg-muted/30 text-neutral-900 dark:text-foreground placeholder-neutral-400 dark:placeholder-muted-foreground border border-neutral-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-foreground"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500 dark:text-muted-foreground mb-1">Company</label>
          <input
            name="company_name"
            placeholder="Coaching Company"
            className="w-full px-3 py-1.5 text-sm bg-transparent dark:bg-muted/30 text-neutral-900 dark:text-foreground placeholder-neutral-400 dark:placeholder-muted-foreground border border-neutral-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 dark:text-muted-foreground mb-1">City</label>
          <input
            name="city"
            placeholder="Lyon"
            className="w-full px-3 py-1.5 text-sm bg-transparent dark:bg-muted/30 text-neutral-900 dark:text-foreground placeholder-neutral-400 dark:placeholder-muted-foreground border border-neutral-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-foreground"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500 dark:text-muted-foreground mb-1">Call date</label>
        <input
          name="call_date"
          type="datetime-local"
          className="w-full px-3 py-1.5 text-sm bg-transparent dark:bg-muted/30 text-neutral-900 dark:text-foreground border border-neutral-200 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-foreground"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 text-sm text-neutral-700 dark:text-foreground/80 border border-neutral-200 dark:border-border rounded-lg hover:bg-neutral-50 dark:hover:bg-muted/50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-2 text-sm bg-neutral-900 dark:bg-foreground text-white dark:text-background rounded-lg hover:bg-neutral-700 dark:hover:bg-foreground/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Adding...' : 'Add'}
        </button>
      </div>
    </form>
  )
}
