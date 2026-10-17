import 'server-only';
import type pg from 'pg';
import { z } from 'zod';
import { transaction, type Queryable } from '@/lib/db';
import { AuthError } from '@/lib/auth/http-auth';
import { newDeviceToken, sha256 } from '@/lib/auth/tokens';
import { HttpError } from '@/lib/http';
import type { HardwareDashboard, HardwareRequest } from './hardware-types';

export const hardwareEventBody = z.strictObject({
  deviceId: z.uuid(), eventId: z.uuid(), event: z.literal('purchase_review_requested'),
  occurredAt: z.iso.datetime().nullable().default(null),
});
export const hardwareHeartbeatBody = z.strictObject({ deviceId: z.uuid() });
export const hardwareName = z.string().trim().min(1).max(40);
export const contactPhone = z.string().regex(/^\+[1-9][0-9]{7,14}$/).nullable();
const hardwareToken = () => newDeviceToken().replace(/^cwd_/, 'cwh_');

async function member(q: Queryable, sub: string, circleId: string, manage = false) {
  // Works on main and when PR #22's roles migration lands. No dependency on it.
  const { rows } = await q.query<{ id: string; role: string }>(
    `select m.id, coalesce(to_jsonb(m)->>'role', 'approver') as role
     from circle_members m where m.circle_id = $1 and m.auth0_sub = $2`, [circleId, sub],
  );
  if (!rows[0]) throw new HttpError(404, 'not_found', 'Family circle not found');
  if (manage && rows[0].role !== 'approver') throw new HttpError(403, 'forbidden', 'An approver must make this change');
  return rows[0];
}

async function device(q: Queryable, token: string, id: string, lock = false) {
  if (!/^cwh_[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthError('Invalid hardware credential');
  const { rows } = await q.query<{ id: string; circle_id: string; label: string }>(
    `select id, circle_id, label from devices
     where id = $1 and token_hash = $2 and device_type = 'esp32' and revoked_at is null
     ${lock ? 'for update' : ''}`, [id, sha256(token)],
  );
  if (!rows[0]) throw new AuthError('Invalid hardware credential');
  return rows[0];
}

export async function registerHardware(pool: pg.Pool, sub: string, circleId: string, name: string) {
  const label = hardwareName.parse(name);
  return transaction(pool, async q => {
    await q.query('select id from circles where id = $1 for update', [circleId]);
    await member(q, sub, circleId, true);
    const count = await q.query<{ count: number }>(
      "select count(*)::int as count from devices where circle_id = $1 and device_type = 'esp32' and revoked_at is null", [circleId],
    );
    if (count.rows[0]!.count >= 8) throw new HttpError(409, 'device_limit', 'Revoke an unused button before adding another (maximum eight)');
    const token = hardwareToken();
    const { rows } = await q.query<{ id: string }>(
      "insert into devices(circle_id, token_hash, label, device_type) values ($1, $2, $3, 'esp32') returning id",
      [circleId, sha256(token), label],
    );
    return { deviceId: rows[0]!.id, token };
  });
}

export async function changeHardwareCredential(pool: pg.Pool, sub: string, circleId: string, deviceId: string, action: 'rotate' | 'revoke') {
  return transaction(pool, async q => {
    await q.query('select id from circles where id = $1 for update', [circleId]);
    await member(q, sub, circleId, true);
    const token = action === 'rotate' ? hardwareToken() : null;
    const result = await q.query(
      `update devices set token_hash = coalesce($3, token_hash),
         revoked_at = case when $4 then coalesce(revoked_at, now()) else revoked_at end
       where id = $1 and circle_id = $2 and device_type = 'esp32'
         and ($4 or revoked_at is null)`,
      [deviceId, circleId, token ? sha256(token) : null, action === 'revoke'],
    );
    if (!result.rowCount) throw new HttpError(404, 'not_found', 'Active button not found');
    return { deviceId, token };
  });
}

export async function acceptHardwareEvent(pool: pg.Pool, token: string, input: z.infer<typeof hardwareEventBody>) {
  const initial = await device(pool, token, input.deviceId);
  return transaction(pool, async q => {
    // Serialize circle-wide spam limits and credential changes with ingestion.
    await q.query('select id from circles where id = $1 for update', [initial.circle_id]);
    const d = await device(q, token, input.deviceId, true);
    const old = await q.query<{ id: string; occurred_at: Date | null }>(
      'select id, occurred_at from alerts where device_id = $1 and event_id = $2', [d.id, input.eventId],
    );
    if (old.rows[0]) {
      if ((old.rows[0].occurred_at?.toISOString() ?? null) !== (input.occurredAt ? new Date(input.occurredAt).toISOString() : null)) {
        throw new HttpError(409, 'event_conflict', 'Event ID was already used with different details');
      }
      return { accepted: true, duplicate: true, requestId: old.rows[0].id, eventId: input.eventId, delivery: 'in_app' };
    }
    if (input.occurredAt && (Date.parse(input.occurredAt) > Date.now()+300000 || Date.parse(input.occurredAt) < Date.UTC(2020,0,1))) {
      throw new HttpError(422, 'invalid_time', 'Button clock is not valid');
    }
    const limit = await q.query<{ too_soon: boolean; hourly: number }>(
      `select coalesce(last_alert_at > now() - interval '10 seconds', false) as too_soon,
       (select count(*)::int from alerts where circle_id = $2 and kind = 'purchase_review_requested'
          and created_at > now() - interval '1 hour') as hourly from devices where id = $1`, [d.id, d.circle_id],
    );
    if (limit.rows[0]!.too_soon || limit.rows[0]!.hourly >= 60) {
      throw new HttpError(429, 'rate_limited', 'Please retry this same event later');
    }
    const { rows } = await q.query<{ id: string }>(
      `insert into alerts(circle_id, kind, detail, device_id, event_id, device_label, occurred_at)
       values ($1, 'purchase_review_requested', 'Your family member pressed their CheckWithUs button and may need help reviewing a purchase.',
         $2, $3, $4, $5) returning id`, [d.circle_id, d.id, input.eventId, d.label, input.occurredAt],
    );
    const requestId = rows[0]!.id;
    await q.query(
      `insert into alert_recipients(alert_id, member_id)
       select $1, id from circle_members where circle_id = $2`, [requestId, d.circle_id],
    );
    await q.query('update devices set last_seen_at = now(), last_alert_at = now() where id = $1', [d.id]);
    return { accepted: true, duplicate: false, requestId, eventId: input.eventId, delivery: 'in_app' };
  });
}

export async function hardwareHeartbeat(pool: pg.Pool, token: string, deviceId: string) {
  await device(pool, token, deviceId);
  // Keep the write bounded even if a misconfigured board sends too frequently.
  const result = await pool.query(
    `update devices set last_seen_at = now() where id = $1 and token_hash = $2
      and revoked_at is null and (last_seen_at is null or last_seen_at < now() - interval '50 seconds')`, [deviceId, sha256(token)],
  );
  return { accepted: true, updated: Boolean(result.rowCount) };
}

export async function resolveHardwareRequest(pool: pg.Pool, sub: string, circleId: string, id: string) {
  const actor = await member(pool, sub, circleId, true);
  const result = await pool.query(
    `update alerts set resolved_at = coalesce(resolved_at, now()), resolved_by = coalesce(resolved_by, $3)
     where id = $1 and circle_id = $2 and kind = 'purchase_review_requested'`, [id, circleId, actor.id],
  );
  if (!result.rowCount) throw new HttpError(404, 'not_found', 'Request not found');
}

export async function saveAssistanceContact(pool: pg.Pool, sub: string, circleId: string, phone: string | null) {
  await member(pool, sub, circleId, true);
  await pool.query('update circles set assistance_contact_phone = $2 where id = $1', [circleId, contactPhone.parse(phone)]);
}

export async function hardwareDashboard(pool: pg.Pool, sub: string, circleId: string): Promise<HardwareDashboard> {
  const actor = await member(pool, sub, circleId);
  const [requests, devices, summary] = await Promise.all([
    pool.query<{
      id: string; device_id: string | null; device_label: string; protected_name: string;
      occurred_at: Date | null; created_at: Date; resolved_at: Date | null; resolved_by_name: string | null; recipients: number;
    }>(
      `select a.*, c.protected_name, m.display_name as resolved_by_name,
        (select count(*)::int from alert_recipients where alert_id = a.id) as recipients
       from alerts a join circles c on c.id = a.circle_id left join circle_members m on m.id = a.resolved_by
       where a.circle_id = $1 and a.kind = 'purchase_review_requested'
       order by (a.resolved_at is null) desc, a.created_at desc limit 50`, [circleId],
    ),
    pool.query<{ id: string; label: string; last_seen_at: Date | null; revoked_at: Date | null }>(
      "select id, label, last_seen_at, revoked_at from devices where circle_id = $1 and device_type = 'esp32' order by created_at desc limit 50", [circleId],
    ),
    pool.query<{ assistance_contact_phone: string | null; count: number }>(
      `select assistance_contact_phone, (select count(*)::int from alerts where circle_id = c.id
       and kind = 'purchase_review_requested' and resolved_at is null) as count from circles c where c.id = $1`, [circleId],
    ),
  ]);
  return {
    requests: requests.rows.map((r): HardwareRequest => ({ id: r.id, deviceId: r.device_id,
      deviceName: r.device_label, protectedName: r.protected_name, pressedAt: r.occurred_at?.toISOString() ?? null,
      receivedAt: r.created_at.toISOString(), resolvedAt: r.resolved_at?.toISOString() ?? null,
      resolvedBy: r.resolved_by_name, status: r.resolved_at ? 'resolved' : 'open', notifiedMembers: r.recipients })),
    devices: devices.rows.map(r => ({ id: r.id, name: r.label, lastSeenAt: r.last_seen_at?.toISOString() ?? null, revokedAt: r.revoked_at?.toISOString() ?? null })),
    contactPhone: summary.rows[0]!.assistance_contact_phone, openCount: summary.rows[0]!.count,
    canManage: actor.role === 'approver',
  };
}
