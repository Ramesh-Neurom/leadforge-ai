import { Badge, type BadgeTone } from './Badge';
import { formatStatus } from '@/lib/leads';

/** Maps a lead / pipeline status to a soft badge tone. */
function toneForStatus(status: string): BadgeTone {
  switch (status) {
    case 'WON':
      return 'emerald';
    case 'QUALIFIED':
    case 'PROPOSAL_SENT':
    case 'NEGOTIATION':
    case 'MEETING_SCHEDULED':
      return 'blue';
    case 'CLIENT_REPLIED':
      return 'sky';
    case 'AI_REVIEWED':
    case 'PROPOSAL_DRAFTED':
    case 'WAITING_APPROVAL':
      return 'indigo';
    case 'FOLLOW_UP_NEEDED':
      return 'amber';
    case 'LOST':
    case 'REJECTED':
      return 'rose';
    default:
      return 'slate';
  }
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge tone={toneForStatus(status)} dot className={className}>
      {formatStatus(status)}
    </Badge>
  );
}
