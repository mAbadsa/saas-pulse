import type { MonitorResponse } from '@saas-pulse/shared';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, ApiError } from '@/lib/api';

interface Props {
  monitor: MonitorResponse | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}

export function DeleteMonitorDialog({ monitor, onOpenChange, onDeleted, onError }: Props) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    if (!monitor) return;
    setDeleting(true);
    try {
      await api(`/monitors/${monitor.id}`, { method: 'DELETE' });
    } catch (err) {
      onError(err instanceof ApiError ? err.messages.join(' ') : 'Delete failed.');
    } finally {
      setDeleting(false);
      onOpenChange(false);
      onDeleted(); // reload either way so the list matches the server
    }
  };

  return (
    <AlertDialog open={monitor !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {monitor?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This also deletes its entire check history. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={() => void confirm()}
          >
            {deleting ? 'Deleting…' : 'Delete monitor'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
