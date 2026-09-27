import type {
  CreateMonitorRequest,
  MonitorResponse,
  UpdateMonitorRequest,
} from '@saas-pulse/shared';
import { useState, type FormEvent } from 'react';
import { FormError } from '@/components/form-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api';

interface Props {
  open: boolean;
  /** Present when editing; absent when adding. */
  monitor?: MonitorResponse;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function MonitorFormDialog({ open, monitor, onOpenChange, onSaved }: Props) {
  const editing = monitor !== undefined;
  const [name, setName] = useState(monitor?.name ?? '');
  const [url, setUrl] = useState(monitor?.url ?? '');
  const [interval, setInterval] = useState(String(monitor?.intervalSeconds ?? 60));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    const intervalSeconds = Number(interval);
    try {
      if (editing) {
        // Send only what changed.
        const patch: UpdateMonitorRequest = {
          ...(name !== monitor.name && { name }),
          ...(url !== monitor.url && { url }),
          ...(intervalSeconds !== monitor.intervalSeconds && { intervalSeconds }),
        };
        if (Object.keys(patch).length) {
          await api(`/monitors/${monitor.id}`, { method: 'PATCH', body: patch });
        }
      } else {
        const body: CreateMonitorRequest = { name, url, intervalSeconds };
        await api('/monitors', { method: 'POST', body });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setErrors(
        err instanceof ApiError
          ? err.messages
          : ['Something went wrong. Please try again.'],
      );
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit monitor' : 'Add monitor'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Changing the URL resets the status to Pending until the next check.'
                : 'We’ll check this URL on the interval you choose.'}
            </DialogDescription>
          </DialogHeader>

          <FormError messages={errors} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="monitor-name">Name</Label>
            <Input
              id="monitor-name"
              required
              maxLength={100}
              placeholder="Marketing site"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="monitor-url">URL</Label>
            <Input
              id="monitor-url"
              type="url"
              required
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="monitor-interval">Check every (seconds)</Label>
            <Input
              id="monitor-interval"
              type="number"
              required
              min={30}
              max={86400}
              step={1}
              aria-describedby="monitor-interval-help"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
            <p id="monitor-interval-help" className="text-muted-foreground text-xs">
              Between 30 and 86,400 seconds (1 day).
            </p>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add monitor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
