import type { TelegramLinkResponse, TelegramStatus } from '@saas-pulse/shared';
import { BellOff, BellRing, CheckCircle2, ExternalLink, Send, Unlink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FormError } from '@/components/form-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';

const LINK_POLL_MS = 3_000;

export function TelegramCard() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [link, setLink] = useState<TelegramLinkResponse | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // State only set in promise callbacks: load() runs from effects.
  const load = useCallback(
    () =>
      api<TelegramStatus>('/alerts/telegram')
        .then((s) => {
          setStatus(s);
          if (s.connected) setLink(null);
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status !== 401) setErrors(err.messages);
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // While a connect link is open, poll until the bot confirms or the link expires.
  useEffect(() => {
    if (!link) return;
    const expiresAt = new Date(link.expiresAt).getTime();
    const timer = setInterval(() => {
      if (Date.now() > expiresAt) {
        clearInterval(timer);
        setLink(null);
        setNotice('The connect link expired. Generate a new one to try again.');
        return;
      }
      void load();
    }, LINK_POLL_MS);
    return () => clearInterval(timer);
  }, [link, load]);

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setErrors([]);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
    } catch (err) {
      setErrors(err instanceof ApiError ? err.messages : ['Something went wrong.']);
    } finally {
      setBusy(false);
    }
  };

  const startLink = () =>
    run(async () => setLink(await api<TelegramLinkResponse>('/alerts/telegram/link', { method: 'POST' })));

  const toggle = () =>
    run(async () =>
      setStatus(
        await api<TelegramStatus>('/alerts/telegram', {
          method: 'PATCH',
          body: { enabled: !status?.enabled },
        }),
      ),
    );

  const sendTest = () =>
    run(() => api('/alerts/telegram/test', { method: 'POST' }), 'Test message sent. Check Telegram.');

  const disconnect = () =>
    run(async () => {
      await api('/alerts/telegram', { method: 'DELETE' });
      await load();
    }, 'Telegram disconnected.');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Telegram alerts
          {status?.connected && (
            <Badge
              variant="outline"
              className="border-green-600/30 text-green-600 dark:text-green-400"
            >
              <CheckCircle2 aria-hidden />
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Get a message when a monitor goes down (after 2 failed checks in a row) and when it
          recovers.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormError messages={errors} />
        {notice && (
          <p role="status" className="text-muted-foreground text-sm">
            {notice}
          </p>
        )}

        {status === null && errors.length === 0 && (
          <p className="text-muted-foreground text-sm" aria-busy="true">
            Loading…
          </p>
        )}

        {status && !status.available && (
          <p className="text-muted-foreground text-sm">
            Telegram alerts aren’t available on this server. The operator needs to set up a
            Telegram bot (<code>TELEGRAM_BOT_TOKEN</code>).
          </p>
        )}

        {status?.available && !status.connected && !link && (
          <Button className="w-fit" disabled={busy} onClick={() => void startLink()}>
            <Send aria-hidden />
            Connect Telegram
          </Button>
        )}

        {status?.available && !status.connected && link && (
          <div className="flex flex-col gap-3 rounded-md border p-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Open the SaaS Pulse bot in Telegram.</li>
              <li>
                Press <strong>Start</strong>.
              </li>
              <li>Come back here. This page updates by itself.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                nativeButton={false}
                render={<a href={link.url} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink aria-hidden />
                Open Telegram
              </Button>
              <span className="text-muted-foreground text-xs" aria-live="polite">
                Waiting for you to press Start… (link valid for 10 minutes)
              </span>
            </div>
          </div>
        )}

        {status?.connected && (
          <>
            <p className="text-sm">
              Alerts are{' '}
              <strong>{status.enabled ? 'on' : 'off'}</strong>
              {status.connectedAt &&
                ` · connected ${new Date(status.connectedAt).toLocaleDateString()}`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void toggle()}>
                {status.enabled ? <BellOff aria-hidden /> : <BellRing aria-hidden />}
                {status.enabled ? 'Turn alerts off' : 'Turn alerts on'}
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void sendTest()}>
                <Send aria-hidden />
                Send test message
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void disconnect()}
                className="text-destructive"
              >
                <Unlink aria-hidden />
                Disconnect
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
