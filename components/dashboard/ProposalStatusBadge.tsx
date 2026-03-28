import { Badge } from '@/components/ui/badge'
import { ProposalStatus } from '@/types/proposal'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<ProposalStatus, { label: string; className: string }> = {
  draft:   { label: 'Draft',   className: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-100' },
  sent:    { label: 'Sent',    className: 'bg-blue-50 text-blue-700 hover:bg-blue-50' },
  signed:  { label: 'Signed',  className: 'bg-amber-50 text-amber-700 hover:bg-amber-50' },
  paid:    { label: 'Paid',    className: 'bg-green-50 text-green-700 hover:bg-green-50' },
  expired: { label: 'Expired', className: 'bg-red-50 text-red-600 hover:bg-red-50' },
}

export default function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}
