'use client';
import { useActionState, useEffect, useState } from 'react';
import type { HardwareDashboard } from '@/lib/hardware-types';
import { hardwareAction } from './hardware-actions';

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:opacity-60';
const input = 'min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 focus:border-teal-700 focus:outline-2 focus:outline-teal-700';
function LocalTime({ value }: { value: string }) {
  const [label, setLabel] = useState(value.replace('T', ' ').replace(/\.\d+Z$/, ' UTC'));
  useEffect(() => setLabel(new Date(value).toLocaleString()), [value]);
  return <time dateTime={value}>{label}</time>;
}

export function HardwarePanel({ circleId, initial }: { circleId: string; initial: HardwareDashboard }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [state, action, pending] = useActionState(hardwareAction, { message: '' });
  const [hiddenToken, setHiddenToken] = useState<string | undefined>();
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let delay = 5000;
    const poll = async () => {
      if (document.visibilityState === 'hidden') { timer = setTimeout(poll, 5000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch(`/api/dashboard/hardware?circleId=${encodeURIComponent(circleId)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to receive new requests.' : 'Updates paused. Retrying automatically.');
        const next = await response.json() as HardwareDashboard;
        if (!stopped) { setData(next); setError(''); delay = 5000; }
      } catch (e) {
        if (!stopped) { setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Updates paused. Retrying automatically.'); delay = Math.min(delay * 2, 30000); }
      } finally {
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(poll, delay);
      }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [circleId, state.changed]);
  const fields = <input type="hidden" name="circleId" value={circleId} />;

  return <section id="family-help" aria-labelledby="hardware-title" className="mb-8 rounded-2xl border border-teal-900/15 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-bold uppercase tracking-widest text-teal-800">Ask my family</p>
        <h2 id="hardware-title" className="mt-1 text-2xl font-semibold">Purchase assistance</h2></div>
      <p role="status" aria-live="polite" className="text-sm font-semibold text-teal-900">{data.openCount ? `${data.openCount} request${data.openCount === 1 ? '' : 's'} needs help` : 'No open requests'}</p>
    </div>
    <p className="mt-2 text-sm text-stone-600">Button requests appear here automatically while this dashboard is open. Email, SMS, and push delivery are not enabled for these requests.</p>
    {error && <p role="alert" className="mt-3 text-sm text-amber-900">{error} <a className="underline" href="/auth/login?returnTo=/dashboard">Sign in</a></p>}
    {state.message && <p role="status" className="mt-3 text-sm font-medium text-teal-900">{state.message}</p>}
    {state.token && state.token !== hiddenToken && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-semibold">Save this button credential privately</h3>
      <p className="mt-2 break-all text-sm">Device ID: <code>{state.deviceId}</code></p>
      <p className="mt-2 break-all text-sm">Device token: <code>{state.token}</code></p>
      <p className="mt-2 text-sm">Put these in your local firmware config. Do not commit or share the token.</p>
      <button type="button" onClick={() => setHiddenToken(state.token)} className={`${button} mt-3`}>I saved it — hide credential</button>
    </div>}
    {!data.requests.length && <p className="mt-5 rounded-lg bg-stone-50 p-4 text-stone-600">When the button reaches checkwith.us, a request will appear here. No purchase information is assumed.</p>}
    <ul className="mt-5 space-y-3">{data.requests.map(r => <li key={r.id} className="rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div>
        <h3 className="font-semibold">Purchase Review Requested</h3>
        <p className="mt-1 text-sm">{r.protectedName} pressed their CheckWithUs button and may need help reviewing a purchase.</p>
      </div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${r.status === 'open' ? 'bg-amber-100 text-amber-950' : 'bg-stone-100 text-stone-700'}`}>{r.status === 'open' ? 'Needs help' : 'Resolved'}</span></div>
      <dl className="mt-3 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
        <div><dt className="font-medium">{r.pressedAt ? 'Button pressed (device clock)' : 'Received (button clock unavailable)'}</dt><dd><LocalTime value={r.pressedAt ?? r.receivedAt} /></dd></div>
        <div><dt className="font-medium">Button</dt><dd>{r.deviceName}<span className="block break-all text-xs">{r.deviceId ?? 'Removed device'}</span></dd></div>
      </dl>
      {r.resolvedAt ? <p className="mt-3 text-sm text-stone-600">Resolved by {r.resolvedBy ?? 'a family member'} · <LocalTime value={r.resolvedAt} /></p> : <div className="mt-4 flex flex-wrap items-center gap-3">
        {data.contactPhone ? <a href={`tel:${data.contactPhone}`} className={button}>Call {r.protectedName.split(' ')[0]}</a> : <a href="#hardware-setup" className="min-h-11 py-3 text-sm font-semibold text-teal-800 underline">Add a contact number in button setup</a>}
        {data.canManage && <form action={action}>{fields}<input type="hidden" name="action" value="resolve" /><input type="hidden" name="requestId" value={r.id} />
          <button disabled={pending} className={button}>Mark resolved</button></form>}
      </div>}
    </li>)}</ul>
    {data.openCount > 50 && <p className="mt-3 text-sm">Showing the newest 50 requests. Resolve requests to see older ones.</p>}
    <details id="hardware-setup" className="mt-6 border-t border-stone-200 pt-4">
      <summary className="cursor-pointer py-2 font-semibold text-teal-900">Button setup and contact number</summary>
      {data.canManage ? <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <form action={action} className="space-y-3">{fields}<input type="hidden" name="action" value="register" />
          <label htmlFor="hardware-name" className="block text-sm font-medium">Friendly button name</label>
          <input id="hardware-name" name="name" required maxLength={40} placeholder="Kitchen button" className={input} />
          <button disabled={pending} className={button}>Register ESP32 button</button>
        </form>
        <form action={action} className="space-y-3">{fields}<input type="hidden" name="action" value="contact" />
          <label htmlFor="hardware-phone" className="block text-sm font-medium">Older adult’s phone number</label>
          <input key={data.contactPhone} id="hardware-phone" type="tel" name="phone" defaultValue={data.contactPhone ?? ''} placeholder="+12025550123" pattern="\+[1-9][0-9]{7,14}" className={input} />
          <p className="text-xs text-stone-600">Include country code. Leave blank to remove. Only your circle can see it.</p>
          <button disabled={pending} className={button}>Save contact number</button>
        </form>
      </div> : <p className="mt-3 text-sm text-stone-600">Ask an approver to register or manage buttons.</p>}
      <ul className="mt-5 divide-y divide-stone-200">{data.devices.map(d => <li key={d.id} className="py-4">
        <p className="font-semibold">{d.name} {d.revokedAt && <span className="text-sm font-normal text-stone-500">— revoked</span>}</p>
        <p className="break-all text-xs text-stone-500">{d.id}</p>
        <p className="mt-1 text-sm text-stone-600">Last contact: {d.lastSeenAt ? <LocalTime value={d.lastSeenAt} /> : 'Not connected yet'}</p>
        {data.canManage && !d.revokedAt && <form action={action} className="mt-3 flex flex-wrap gap-3">{fields}<input type="hidden" name="deviceId" value={d.id} />
          <button name="action" value="rotate" disabled={pending} className={button}>Replace credential</button>
          <button name="action" value="revoke" disabled={pending} className="min-h-11 rounded-lg border border-stone-300 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-teal-800">Revoke button</button>
        </form>}
      </li>)}</ul>
    </details>
  </section>;
}
