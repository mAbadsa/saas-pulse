import type { MonitorResponse } from '@saas-pulse/shared';
import { Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { relativeTime } from '@/lib/time';
import { StatusBadge } from './StatusBadge';

interface Props {
  monitor: MonitorResponse;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Stacks on phones, one line from `sm` up (card layout instead of a wide table). */
export function MonitorRow({ monitor, busy, onToggle, onEdit, onDelete }: Props) {
  const m = monitor;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={m.name}>
          {m.name}
        </p>
        <p className="text-muted-foreground truncate text-sm" title={m.url}>
          {m.url}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:w-64 sm:shrink-0">
        <StatusBadge monitor={m} />
        <span className="text-muted-foreground">
          <time dateTime={m.lastCheckedAt ?? undefined}>
            Checked {relativeTime(m.lastCheckedAt).toLowerCase()}
          </time>
          {' · '}every {m.intervalSeconds}s
        </span>
      </div>

      <div className="flex gap-2 sm:shrink-0">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onToggle}
          aria-label={`${m.isActive ? 'Pause' : 'Resume'} ${m.name}`}
        >
          {m.isActive ? <Pause aria-hidden /> : <Play aria-hidden />}
          {m.isActive ? 'Pause' : 'Resume'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onEdit}
          aria-label={`Edit ${m.name}`}
        >
          <Pencil aria-hidden />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onDelete}
          aria-label={`Delete ${m.name}`}
          className="text-destructive"
        >
          <Trash2 aria-hidden />
          Delete
        </Button>
      </div>
    </li>
  );
}
