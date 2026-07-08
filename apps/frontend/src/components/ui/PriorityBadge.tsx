import { Badge, type BadgeTone } from './Badge';

function toneForPriority(priority: string): BadgeTone {
  switch (priority.toUpperCase()) {
    case 'HIGH':
    case 'URGENT':
      return 'rose';
    case 'MEDIUM':
      return 'amber';
    case 'LOW':
      return 'slate';
    default:
      return 'slate';
  }
}

function labelForPriority(priority: string) {
  const upper = priority.toUpperCase();
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority?: string | null;
  className?: string;
}) {
  if (!priority) {
    return (
      <Badge tone="slate" className={className}>
        —
      </Badge>
    );
  }

  return (
    <Badge tone={toneForPriority(priority)} className={className}>
      {labelForPriority(priority)}
    </Badge>
  );
}
