import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth0 } from '@/lib/auth0/web';
import { CATEGORY_LABELS, type Category } from '@/lib/categories';
import { db } from '@/lib/db';
import { familyPayments, memberships } from '@/lib/family';
import { VAULT_CENTS_SQL } from '@/lib/vault';
import { formatCents, toCents } from '@/lib/money';
import { cibaApprovals, payments } from '@/lib/services';
import { Countdown, FreezeControl, JoinForm, SettingsForms } from './controls';

type SpendRow = { day: Date; category: Category; total_cents: string };
type CircleRow = { hold_over_cents: string; protected_name: string; frozen: boolean; vault_cents: number };
type MemberRow = { id: string; display_name: string };
type PayeeRow = { id: string; name: string; kind: string; category: Category };
const money = (cents: bigint | number | string) => formatCents(toCents(Number(cents)));

export default function Dashboard(props: { searchParams: Promise<{ circle?: string }> }) {
  return <Suspense fallback={<main className="mx-auto max-w-7xl px-6 py-12" aria-busy="true"><p className="text-stone-600">Loading your family dashboard…</p></main>}>
    <DashboardContent {...props} />
  </Suspense>;
}

async function DashboardContent({ searchParams }: { searchParams: Promise<{ circle?: string }> }) {
  await connection();
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  const circles = await memberships(db(), session.user.sub);
  if (!circles.length) return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
    <Link href="/" className="text-xl font-bold text-teal-950">checkwith.us</Link>
    <h1 className="mt-10 text-4xl font-semibold tracking-tight">Join your family circle</h1>
    <p className="mt-3 text-stone-600">Ask a family member for the invite code. Your account will then show the payments you can help review.</p>
    <JoinForm />
    <a href="/auth/logout" className="mt-8 text-sm font-medium text-teal-800 underline">Sign out</a>
  </main>;

  const requested = (await searchParams).circle;
  const active = circles.find((circle) => circle.circleId === requested) ?? circles[0]!;
  await cibaApprovals()?.pollCircles([active.circleId]);
  const [recent, held, spendResult, circleResult, memberResult, payeeResult] = await Promise.all([
    familyPayments(db(), payments(), session.user.sub, { heldOnly: false, circleId: active.circleId }),
    // Query holds independently: newer completed payments must not hide them.
    familyPayments(db(), payments(), session.user.sub, { heldOnly: true, circleId: active.circleId }),
    db().query<SpendRow>(
      `select day, category, total_cents::text
         from spending_daily where circle_id = $1 and day >= now() - interval '90 days'
        order by day`, [active.circleId],
    ),
    db().query<CircleRow>(`select protected_name, hold_over_cents::text, frozen, ${VAULT_CENTS_SQL} as vault_cents
      from circles c where c.id = $1`, [active.circleId]),
    db().query<MemberRow>('select id, display_name from circle_members where circle_id = $1 order by created_at', [active.circleId]),
    db().query<PayeeRow>('select id, name, kind, category from payees where circle_id = $1 order by name', [active.circleId]),
  ]);
  const circle = circleResult.rows[0]!;
  const categories = new Map<Category, bigint>();
  const weeks = Array<bigint>(13).fill(0n);
  for (const row of spendResult.rows) {
    const cents = BigInt(row.total_cents);
    categories.set(row.category, (categories.get(row.category) ?? 0n) + cents);
    const age = Math.floor((Date.now() - row.day.getTime()) / (7 * 86_400_000));
    if (age >= 0 && age < weeks.length) weeks[12 - age] += cents;
  }
  const total = [...categories.values()].reduce((sum, cents) => sum + cents, 0n);
  const categoryRows = [...categories].sort((a, b) => a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0);
  const largestCategory = categoryRows[0]?.[1] ?? 1n;
  const largestWeek = weeks.reduce((max, week) => week > max ? week : max, 1n);

  return <main className="min-h-screen bg-[#f7f5f0] text-stone-900">
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-7 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-teal-950">checkwith<span className="text-teal-700">.us</span></Link>
        <nav aria-label="Dashboard" className="flex items-center gap-5 text-sm font-semibold text-stone-600">
          <a href="#activity" className="hover:text-teal-800">Activity</a><a href="#setup" className="hover:text-teal-800">Setup</a>
          <a href="/auth/logout" className="hover:text-teal-800">Sign out</a>
        </nav>
      </header>
      <section className="flex flex-wrap items-end justify-between gap-6 py-9">
        <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-800">Family overview</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Looking out for {circle.protected_name.split(' ')[0]}</h1>
          <p className="mt-3 max-w-2xl text-stone-600">See what needs attention and how everyday spending is changing.</p></div>
        {circles.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Family circles">{circles.map((item) =>
          <Link key={item.circleId} href={`/dashboard?circle=${item.circleId}`} aria-current={item.circleId === active.circleId ? 'page' : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${item.circleId === active.circleId ? 'border-teal-800 bg-teal-800 text-white' : 'border-stone-300 bg-white text-stone-700'}`}>{item.protectedName}</Link>)}</div>}
      </section>

      <FreezeControl circleId={active.circleId} frozen={circle.frozen} firstName={circle.protected_name.split(' ')[0]!}
        vaultLabel={money(circle.vault_cents)} vaultDollars={String(Math.floor(circle.vault_cents / 100))} />
      <section aria-labelledby="attention-title" className="rounded-2xl border border-teal-900/15 bg-[#e6f0eb] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-teal-800">Needs attention</p>
          <h2 id="attention-title" className="mt-1 text-2xl font-semibold">{held.length ? `${held.length} payment${held.length === 1 ? '' : 's'} waiting` : 'All clear right now'}</h2></div>
          <p className="text-sm text-teal-950">{held.length ? 'A Guardian notification lets the family approve or deny.' : 'New held payments will appear here.'}</p></div>
        {held.length > 0 && <ul role="list" className="mt-6 grid gap-4 lg:grid-cols-2">{held.map((payment) => <li key={payment.id} className="rounded-xl border border-teal-900/10 bg-white p-5">
          <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-stone-500">{payment.protectedName} is paying</p><h3 className="mt-1 text-xl font-semibold">{payment.payee.name}</h3></div>
            <strong className="text-xl tabular-nums">{money(payment.amountCents)}</strong></div>
          <p className="mt-3 text-sm font-semibold text-amber-900">{payment.expiresAt && <Countdown expiresAt={payment.expiresAt} />}</p>
          <p className="mt-3 text-sm leading-6 text-stone-700">{payment.explanation || 'This payment triggered a safety rule and needs a family decision.'}</p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Reasons for hold">{payment.holdReasons.map((reason) => <li key={reason.code} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">{reason.label}</li>)}</ul>
        </li>)}</ul>}
      </section>

      <section id="activity" aria-labelledby="spending-title" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-teal-800">Last 90 days</p>
          <h2 id="spending-title" className="mt-1 text-2xl font-semibold">Spending at a glance</h2></div>
          <p className="text-3xl font-semibold tabular-nums">{money(total)}</p></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">Weekly spending</h3>
            <div role="img" aria-label="Weekly spending across the last 90 days" className="mt-6 flex h-44 items-end gap-2 border-b border-stone-200 pb-1">{weeks.map((week, index) => <div key={index} className="group relative flex h-full flex-1 items-end">
              <div className="w-full rounded-t bg-teal-700/80" style={{ height: `${Math.max(week > 0n ? 5 : 0, Number(week * 100n / largestWeek))}%` }} />
              <span className="sr-only">Week {index + 1}: {money(week)}.</span></div>)}</div>
            <div className="mt-2 flex justify-between text-xs text-stone-500"><span>12 weeks ago</span><span>This week</span></div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">By category</h3>
            {categoryRows.length ? <ul role="list" className="mt-5 space-y-4">{categoryRows.slice(0, 5).map(([category, cents]) => <li key={category}>
              <div className="flex justify-between gap-3 text-sm"><span>{CATEGORY_LABELS[category] ?? category}</span><span className="font-semibold tabular-nums">{money(cents)}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-teal-700" style={{ width: `${Number(cents * 100n / largestCategory)}%` }} /></div>
            </li>)}</ul> : <p className="mt-5 text-sm text-stone-600">Spending history will appear after the first payment.</p>}
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">Recent payments</h3>
          {recent.length ? <ul role="list" className="mt-3 divide-y divide-stone-100">{recent.slice(0, 8).map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span><strong className="font-semibold">{payment.payee.name}</strong><span className="ml-2 text-stone-500">{payment.category.label}</span></span>
            <span className="flex items-center gap-4"><span className="capitalize text-stone-600">{payment.status}</span><strong className="tabular-nums">{money(payment.amountCents)}</strong></span>
          </li>)}</ul> : <p className="mt-3 text-sm text-stone-600">Payments from the phone will appear here.</p>}
        </div>
      </section>

      <section id="setup" aria-labelledby="setup-title" className="mt-12"><p className="text-sm font-bold uppercase tracking-widest text-teal-800">Family circle</p>
        <h2 id="setup-title" className="mt-1 text-2xl font-semibold">Settings and people</h2>
        <div className="mt-5 rounded-xl border border-stone-200 bg-white p-5"><h3 className="font-semibold">Members</h3>
          <ul role="list" className="mt-3 flex flex-wrap gap-2">{memberResult.rows.map((member) => <li key={member.id} className="rounded-full bg-stone-100 px-4 py-2 text-sm">{member.display_name}</li>)}</ul>
          <h3 className="mt-6 font-semibold">Known payees</h3>
          <p className="mt-2 text-sm text-stone-600">{payeeResult.rows.length ? payeeResult.rows.map((payee) => payee.name).join(' · ') : 'None yet'}</p></div>
        <div className="mt-5"><SettingsForms circleId={active.circleId} holdDollars={(BigInt(circle.hold_over_cents) / 100n).toString() + '.' + (BigInt(circle.hold_over_cents) % 100n).toString().padStart(2, '0')} /></div>
      </section>
      <footer className="mt-12 border-t border-stone-200 pt-6 text-xs text-stone-500">Scam analysis stays on the older adult’s iPhone. Family decisions move payments through fixed rules.</footer>
    </div>
  </main>;
}
