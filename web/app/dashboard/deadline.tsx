'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** The server still decides expiry; this only prevents stale UI actions. */
export function useRemainingSeconds(expiresAt?: string | null) {
  const [clock, setClock] = useState<{ expiresAt: string; seconds: number } | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const deadline = Date.parse(expiresAt);
      setClock({ expiresAt, seconds: Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0 });
    };
    update();
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [expiresAt]);
  return expiresAt && clock?.expiresAt === expiresAt ? clock.seconds : null;
}

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const seconds = useRemainingSeconds(expiresAt);
  const router = useRouter();
  const refreshed = useRef<string | null>(null);
  useEffect(() => {
    if (seconds === 0 && refreshed.current !== expiresAt) {
      refreshed.current = expiresAt;
      // A read runs expireOverdue and displays the authoritative server state.
      // Refresh once per deadline, including when returning to a background tab.
      router.refresh();
    }
  }, [seconds, expiresAt, router]);
  return <time dateTime={expiresAt} aria-label={`Decision deadline ${new Date(expiresAt).toUTCString()}`}>
    {seconds === null ? 'Checking deadline…' : seconds === 0 ? 'Time is up. Checking payment status.'
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} left`}
  </time>;
}
