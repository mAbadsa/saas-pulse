import { useEffect, useRef } from 'react';

/** Error summary for a failed submit: announced, and focused so keyboard users land on it. */
export function FormError({ messages }: { messages: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) ref.current?.focus();
  }, [messages]);

  if (!messages.length) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
    >
      {messages.length === 1 ? (
        messages[0]
      ) : (
        <ul className="list-disc pl-4">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
