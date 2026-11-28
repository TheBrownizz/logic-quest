import type { SyncStatus } from '../../cloud/sync'

const LABEL: Record<SyncStatus, { icon: string; text: string }> = {
  synced: { icon: '✓', text: 'מסונכרן' },
  saving: { icon: '⟳', text: 'שומר…' },
  offline: { icon: '⚠', text: 'לא מסונכרן, ננסה שוב' },
}

export function SyncBadge({ status }: { status: SyncStatus }) {
  const l = LABEL[status]
  return (
    <span className={`sync-badge ${status}`} role="status" aria-label={l.text} title={l.text} data-testid="sync-badge" data-status={status}>
      <span aria-hidden="true">{l.icon}</span>
    </span>
  )
}
