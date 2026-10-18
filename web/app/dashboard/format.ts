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

// ponytail: the demo family is in Gainesville; use the circle's time_zone if families span zones.
const zone = 'America/New_York';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
const weekday = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', month: 'short', day: 'numeric' });
const clockTime = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' });
const monthName = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'long' });

/** "2026-10-17" in the family's time zone, for grouping by day. */
export const localDay = (date: Date) => dayKey.format(date);
/** "3:02 PM" in the family's time zone. */
export const timeOfDay = (date: Date) => clockTime.format(date);
/** "October" in the family's time zone. */
export const monthOf = (date: Date) => monthName.format(date);

/** "Today", "Yesterday" or "Friday, Oct 9". */
export function dayHeading(date: Date, now: Date): string {
  const day = localDay(date);
  if (day === localDay(now)) return 'Today';
  if (day === localDay(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
  return weekday.format(date);
}

type Money = { status: string; amountCents: number; createdAt: string | null };

/** Money the family kept from moving: denials this month plus everything still waiting. Integer cents. */
export function moneyProtected(payments: Money[], held: Money[], now: Date) {
  const month = localDay(now).slice(0, 7);
  const deniedCents = payments
    .filter((payment) => payment.status === 'denied' && payment.createdAt && localDay(new Date(payment.createdAt)).startsWith(month))
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const heldCents = held.reduce((sum, payment) => sum + payment.amountCents, 0);
  return { deniedCents, heldCents };
}

/** The usual week: the mean of the finished weeks (all but the last), whole cents. Zero when there is no history. */
export function usualWeekCents(weeks: number[]): number {
  const finished = weeks.slice(0, -1);
  return finished.length ? Math.round(finished.reduce((sum, cents) => sum + cents, 0) / finished.length) : 0;
}

/** The speed card's headline. Under 1.5x the gap is noise on one family's data, so it says so instead of claiming a speedup. */
export function speedHeadline({ aggregateMs, rawMs }: { aggregateMs: number; rawMs: number }): string {
  const ratio = rawMs / aggregateMs;
  return ratio >= 1.5 ? `${ratio.toFixed(1)}x faster.` : `Both under ${Math.floor(Math.max(rawMs, aggregateMs)) + 1} ms at this size.`;
}
