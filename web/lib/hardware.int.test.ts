import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptHardwareEvent, changeHardwareCredential, hardwareDashboard, hardwareEventBody, registerHardware, resolveHardwareRequest, saveAssistanceContact } from './hardware';
import { requireDevice } from './auth/device';
import { familyAlerts } from './family';
import { newDeviceToken, sha256 } from './auth/tokens';

vi.mock('next/server', async original => ({ ...await original<typeof import('next/server')>(), connection: async () => {} }));
const session = vi.hoisted(() => ({ sub: '' }));
vi.mock('@/lib/auth0/web', () => ({ auth0: { getSession: async () => session.sub ? { user: { sub: session.sub } } : null } }));
const { POST } = await import('@/app/api/device/alert/route');
const { POST: heartbeat } = await import('@/app/api/device/heartbeat/route');
const { GET: dashboard } = await import('@/app/api/dashboard/hardware/route');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
const sub = `test|hardware-${crypto.randomUUID()}`;
let circleId: string;
let otherCircleId: string;
let credential: { deviceId: string; token: string };
const event = () => ({ deviceId: credential.deviceId, eventId: crypto.randomUUID(), event: 'purchase_review_requested' as const, occurredAt: null });
function request(body: unknown, token = credential.token) {
  return new Request('https://checkwith.us/api/device/alert', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
beforeAll(async () => {
  const c = await pool.query<{ id: string }>(
    `insert into circles(protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Hardware Rosa (synthetic)', 'test', $1, 0), ('Other (synthetic)', 'test', $2, 0) returning id`,
    [crypto.randomUUID(), crypto.randomUUID()],
  );
  [circleId, otherCircleId] = c.rows.map(r => r.id) as [string, string];
  await pool.query(`insert into circle_members(circle_id, auth0_sub, display_name)
    values ($1, $2, 'Family One'), ($1, $3, 'Family Two'), ($4, $5, 'Other Family')`, [circleId, sub, `${sub}-two`, otherCircleId, `${sub}-other`]);
  credential = await registerHardware(pool, sub, circleId, 'Kitchen button');
});
beforeEach(async () => {
  await pool.query('delete from alerts where circle_id = $1', [circleId]);
  await pool.query('update devices set last_alert_at = null where circle_id = $1', [circleId]);
  session.sub = sub;
});
afterAll(async () => {
  await pool.query('delete from circles where id = any($1::uuid[])', [[circleId, otherCircleId]]);
  await pool.end();
});

describe('ESP32 assistance', () => {
  it('creates one request and per-member notifications, without invented purchase facts', async () => {
    const body = event();
    const response = await POST(request(body), {});
    expect(response.status).toBe(201);
    expect(response.headers.get('X-CheckWith-Accepted')).toBe(body.eventId);
    expect(await response.json()).toMatchObject({ accepted: true, duplicate: false, delivery: 'in_app' });
    const data = await hardwareDashboard(pool, sub, circleId);
    expect(data.openCount).toBe(1);
    expect(data.requests[0]).toMatchObject({ deviceName: 'Kitchen button', protectedName: 'Hardware Rosa (synthetic)', pressedAt: null, status: 'open', notifiedMembers: 2 });
    expect(data.requests[0]).not.toHaveProperty('amountCents');
    expect(data.devices[0]!.lastSeenAt).not.toBeNull();
    expect((await familyAlerts(pool, sub))[0]?.kind).toBe('purchase_review_requested');
  });
  it('deduplicates concurrent retries and allows replay even during cooldown', async () => {
    const body = event();
    const results = await Promise.all(Array.from({ length: 5 }, () => acceptHardwareEvent(pool, credential.token, body)));
    expect(new Set(results.map(r => r.requestId)).size).toBe(1);
    expect(results.filter(r => !r.duplicate)).toHaveLength(1);
    expect((await pool.query('select * from alert_recipients where alert_id = $1', [results[0]!.requestId])).rows).toHaveLength(2);
    expect((await POST(request(body), {})).status).toBe(200);
    const limited = await POST(request(event()), {});
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
  });
  it('rejects missing/bad credentials, spoofed devices, events and timestamps', async () => {
    expect((await POST(request(event(), 'bad-token'), {})).status).toBe(401);
    expect((await POST(request({ ...event(), deviceId: crypto.randomUUID() }), {})).status).toBe(401);
    expect((await POST(request({ ...event(), event: 'approve_payment' }), {})).status).toBe(400);
    expect((await POST(request({ ...event(), circleId: otherCircleId }), {})).status).toBe(400);
    expect((await POST(request({ ...event(), occurredAt: '2099-01-01T00:00:00Z' }), {})).status).toBe(422);
    const valid = { ...event(), occurredAt: '2026-10-17T01:00:00Z' };
    await acceptHardwareEvent(pool, credential.token, valid);
    await expect(acceptHardwareEvent(pool, credential.token, { ...valid, occurredAt: null })).rejects.toMatchObject({ status: 409 });
    expect(hardwareEventBody.safeParse({ ...event(), merchant: 'invented' }).success).toBe(false);
  });
  it('isolates hardware credentials from phone payment permissions', async () => {
    await expect(requireDevice(pool, request({}, credential.token))).rejects.toMatchObject({ name: 'AuthError' });
    const phone = newDeviceToken();
    const d = await pool.query<{ id: string }>('insert into devices(circle_id, token_hash, label) values ($1,$2,$3) returning id', [circleId, sha256(phone), 'Phone']);
    expect((await POST(request({ ...event(), deviceId: d.rows[0]!.id }, phone), {})).status).toBe(401);
  });
  it('requires family membership for registration, reading, contact changes and resolution', async () => {
    const accepted = await acceptHardwareEvent(pool, credential.token, event());
    await expect(registerHardware(pool, `${sub}-other`, circleId, 'Intruder')).rejects.toMatchObject({ status: 404 });
    await expect(hardwareDashboard(pool, `${sub}-other`, circleId)).rejects.toMatchObject({ status: 404 });
    await expect(resolveHardwareRequest(pool, `${sub}-other`, otherCircleId, accepted.requestId)).rejects.toMatchObject({ status: 404 });
    await expect(saveAssistanceContact(pool, `${sub}-other`, circleId, '+12025550123')).rejects.toMatchObject({ status: 404 });
    await saveAssistanceContact(pool, sub, circleId, '+12025550123');
    expect((await hardwareDashboard(pool, sub, circleId)).contactPhone).toBe('+12025550123');
    await resolveHardwareRequest(pool, sub, circleId, accepted.requestId);
    await resolveHardwareRequest(pool, sub, circleId, accepted.requestId);
    expect((await hardwareDashboard(pool, `${sub}-two`, circleId)).requests[0]!.status).toBe('resolved');
  });
  it('protects dashboard polling with the Auth0 session and circle access', async () => {
    const req = new Request(`https://checkwith.us/api/dashboard/hardware?circleId=${circleId}`);
    session.sub=''; expect((await dashboard(req, {})).status).toBe(401);
    session.sub=`${sub}-other`; expect((await dashboard(req, {})).status).toBe(404);
    session.sub=sub; const response = await dashboard(req, {});
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(JSON.stringify(await response.json())).not.toContain(credential.token);
  });
  it('rotates/revokes credentials immediately and authenticates heartbeat', async () => {
    const created=await registerHardware(pool, sub, circleId, 'Test rotation');
    expect((await heartbeat(request({ deviceId: created.deviceId }, created.token), {})).status).toBe(200);
    await expect(changeHardwareCredential(pool, `${sub}-other`, circleId, created.deviceId, 'rotate')).rejects.toMatchObject({ status: 404 });
    const rotated=await changeHardwareCredential(pool, sub, circleId, created.deviceId, 'rotate');
    expect((await heartbeat(request({ deviceId: created.deviceId }, created.token), {})).status).toBe(401);
    expect((await heartbeat(request({ deviceId: created.deviceId }, rotated.token!), {})).status).toBe(200);
    await changeHardwareCredential(pool, sub, circleId, created.deviceId, 'revoke');
    expect((await POST(request({ ...event(), deviceId: created.deviceId }, rotated.token!), {})).status).toBe(401);
  });
  it('limits new events across devices in the same family', async () => {
    await pool.query(`insert into alerts(circle_id,kind) select $1,'purchase_review_requested' from generate_series(1,60)`, [circleId]);
    expect((await POST(request(event()), {})).status).toBe(429);
  });
});
