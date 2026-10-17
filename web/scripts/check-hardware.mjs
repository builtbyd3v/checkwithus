// A synthetic smoke test, not load testing. Credentials come only from the shell.
import { randomUUID } from 'node:crypto';
const deviceId = process.env.CW_DEVICE_ID;
const token = process.env.CW_HARDWARE_TOKEN;
const base = process.env.CW_BASE_URL ?? 'https://checkwith.us';
const eventId = process.env.CW_EVENT_ID ?? randomUUID();
if (!deviceId || !token || !base.startsWith('https://')) {
  console.error('Set CW_DEVICE_ID, CW_HARDWARE_TOKEN and an HTTPS CW_BASE_URL (optional).');
  process.exit(1);
}
console.log(`Synthetic event ID: ${eventId}. Reuse CW_EVENT_ID on an uncertain retry.`);
const body = JSON.stringify({ deviceId, eventId, event: 'purchase_review_requested', occurredAt: null });
try {
  let original;
  for (let attempt=0; attempt<2; attempt++) {
    const response = await fetch(`${base}/api/device/alert`, { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body, signal: AbortSignal.timeout(15000), redirect: 'error' });
    const data = await response.json();
    console.log(JSON.stringify({ status: response.status, accepted: data.accepted, duplicate: data.duplicate, requestId: data.requestId }));
    if (!response.ok || data.accepted !== true || response.headers.get('X-CheckWith-Accepted') !== eventId) throw new Error();
    if (attempt && (data.requestId !== original || !data.duplicate)) throw new Error();
    original = data.requestId;
  }
  console.log('One persistent request, duplicate retry confirmed. Check the linked dashboard.');
} catch { console.error('Smoke test did not complete. Check status/config; reuse the event ID above if retrying. Credentials withheld.'); process.exitCode=1; }
