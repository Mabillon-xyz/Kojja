'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { exportProposalToPdf } from '@/lib/pdf'

export default function ExportPdfButton({ proposalTitle }: { proposalTitle: string }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      await exportProposalToPdf('proposal-document', proposalTitle)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
      {exporting ? 'Exporting…' : 'Export PDF'}
    </Button>
  )
}
