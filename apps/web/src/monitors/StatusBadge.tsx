import type { MonitorResponse } from '@saas-pulse/shared';
import { CheckCircle2, Clock, PauseCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const LABEL = { UP: 'Up', DOWN: 'Down', PENDING: 'Pending' } as const;

/** Text + icon, never colour alone. Paused takes precedence over the last status. */
export function StatusBadge({
  monitor,
}: {
  monitor: Pick<MonitorResponse, 'status' | 'isActive'>;
}) {
  const { status, isActive } = monitor;

  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge variant="outline" className="text-muted-foreground">
          <PauseCircle aria-hidden />
          Paused
        </Badge>
        <span className="text-muted-foreground text-xs">
          last: {LABEL[status]}
        </span>
      </span>
    );
  }
  if (status === 'UP') {
    return (
      <Badge
        variant="outline"
        className="border-green-600/30 text-green-600 dark:text-green-400"
      >
        <CheckCircle2 aria-hidden />
        Up
      </Badge>
    );
  }
  if (status === 'DOWN') {
    return (
      <Badge variant="destructive">
        <XCircle aria-hidden />
        Down
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Clock aria-hidden />
      Pending
    </Badge>
  );
}
