/** Plain words for the dashboard. Pure, so the unit tests can pin the wording. */

type Alert = { kind: string; detail: string | null };

/** The headline for an alert, or null for a kind this dashboard does not know (skipped, not guessed). */
export function alertHeadline(alert: Alert, firstName: string): string | null {
  if (alert.kind === 'ask_family') return `${firstName} tapped “Ask my family” and wants a call`;
  if (alert.kind !== 'bank_during_call') return null;
  // The phone sends "At a bank (Seven Corners 1 ATM) while on a phone call."
  const place = alert.detail?.match(/^At a bank \((.{1,120})\)/)?.[1];
  return place
    ? `${firstName} is at a bank (${place}) while on a phone call`
    : `${firstName} is at a bank while on a phone call`;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday". */
export function timeAgo(then: Date, now: Date): string {
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000);
  if (seconds > -60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes > -60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}
