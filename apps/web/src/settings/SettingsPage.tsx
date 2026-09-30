import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { TelegramCard } from './TelegramCard';

export function SettingsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <Link
        to="/"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All monitors
      </Link>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <TelegramCard />
    </main>
  );
}
