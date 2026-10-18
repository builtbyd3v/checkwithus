import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { Queryable } from './db';
import { unpairDevices } from './family';

const database = new PGlite();
// PGlite answers query() with { rows } like pg, which is all unpairDevices reads.
const q = database as unknown as Queryable;
const circle = '11111111-1111-4111-8111-111111111111';
const otherCircle = '22222222-2222-4222-8222-222222222222';
const now = () => Math.floor(Date.now() / 1000);

beforeAll(async () => {
  await database.exec(`create table circle_members (id uuid default gen_random_uuid(), circle_id uuid, auth0_sub text, role text);
    create table devices (id uuid default gen_random_uuid(), circle_id uuid, token_hash text, revoked_at timestamptz);`);
}, 30_000);
afterAll(() => database.close());
beforeEach(async () => {
  await database.exec('truncate circle_members, devices');
  await database.query(`insert into circle_members (circle_id, auth0_sub, role) values ($1, 'approver', 'approver'), ($1, 'viewer', 'viewer')`, [circle]);
  await database.query(`insert into devices (circle_id, token_hash) values ($1, 'a'), ($2, 'b')`, [circle, otherCircle]);
});
const live = async () => (await database.query<{ circle_id: string }>('select circle_id from devices where revoked_at is null')).rows;

it('revokes only this circle\'s phone for an approver with a fresh sign-in', async () => {
  expect(await unpairDevices(q, 'approver', now(), circle)).toEqual({ unpaired: 1 });
  expect(await live()).toEqual([{ circle_id: otherCircle }]);
  expect(await unpairDevices(q, 'approver', now(), circle)).toEqual({ unpaired: 0 });
});

it('refuses a viewer, a stranger and a stale sign-in, and revokes nothing', async () => {
  await expect(unpairDevices(q, 'viewer', now(), circle)).rejects.toMatchObject({ status: 403, code: 'permission_required' });
  await expect(unpairDevices(q, 'stranger', now(), circle)).rejects.toMatchObject({ status: 404 });
  await expect(unpairDevices(q, 'approver', now() - 600, circle)).rejects.toMatchObject({ status: 403, code: 'step_up_required' });
  await expect(unpairDevices(q, 'approver', undefined, circle)).rejects.toMatchObject({ code: 'step_up_required' });
  expect(await live()).toHaveLength(2);
});
