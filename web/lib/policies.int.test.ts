import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPaymentService } from '@/lib/payments';
import { createFakeNessie } from '@/test/fake-nessie';
import { createNessieClient } from '@/lib/nessie/client';
import { grantAllowance, revokeAllowance } from '@/lib/allowances';
import { toCents } from '@/lib/money';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const fake = createFakeNessie();
const service = createPaymentService({ pool, nessie: createNessieClient({ key: 'test', fetch: fake.fetch }) });
let circleId: string;
let approver: string;
let second: string;
let viewer: string;
const sub = `test|policy-${crypto.randomUUID()}`;
const bill = (amount = 40000, onCall = false) => ({
  idempotencyKey: crypto.randomUUID(), amountCents: toCents(amount), payeeName: 'Policy Power',
  payeeKind: 'biller' as const, category: 'utilities' as const, onCall, guard: null, explanation: null,
});
beforeAll(async () => {
  const c = await pool.query<{ id: string }>(
    `insert into circles(protected_name, nessie_customer_id, nessie_account_id, opening_balance_cents)
     values ('Policy Test (synthetic)', 'test', $1, 5000000) returning id`, [crypto.randomUUID()],
  );
  circleId = c.rows[0]!.id;
  const m = await pool.query<{ id: string }>(
    `insert into circle_members(circle_id, auth0_sub, display_name, role)
     values ($1, $2, 'Approver', 'approver'), ($1, $3, 'Second', 'approver'), ($1, $4, 'Viewer', 'viewer') returning id`,
    [circleId, sub, `${sub}-second`, `${sub}-viewer`],
  );
  [approver, second, viewer] = m.rows.map(r => r.id) as [string, string, string];
  await pool.query(`insert into payees(circle_id, name, normalized_name, kind, category)
    values ($1, 'Policy Power', 'policy power', 'biller', 'utilities')`, [circleId]);
});
afterAll(async () => { await pool.query('delete from circles where id = $1', [circleId]); await pool.end(); });

describe('family policies', () => {
  it('requires distinct approvers and sends once under concurrent second votes', async () => {
    const p = await service.createPayment(circleId, bill(150000));
    expect(p.approvalsRequired).toBe(2);
    const vote = (memberId: string) => service.decidePayment({ paymentId: p.id, member: { memberId }, decision: 'approve', via: 'ciba' });
    expect((await vote(approver)).status).toBe('held');
    expect((await vote(approver)).status).toBe('held');
    await expect(vote(viewer)).rejects.toMatchObject({ code: 'not_found' });
    await Promise.allSettled([vote(second), vote(second)]);
    expect((await service.getPayment(p.id))?.status).toBe('paid');
    expect(fake.paymentWrites().filter(w => JSON.stringify(w.body).includes(p.id))).toHaveLength(1);
  });
  it('denial stops a partially approved payment', async () => {
    const p = await service.createPayment(circleId, bill(150000));
    await service.decidePayment({ paymentId: p.id, member: { memberId: approver }, decision: 'approve', via: 'ciba' });
    const result = await service.decidePayment({ paymentId: p.id, member: { memberId: second }, decision: 'deny', via: 'ciba' });
    expect(result.status).toBe('denied');
    expect(fake.paymentWrites().filter(w => JSON.stringify(w.body).includes(p.id))).toHaveLength(0);
  });
  it('an approver who approved can change their mind to Deny', async () => {
    const p = await service.createPayment(circleId, bill(150000));
    await service.decidePayment({ paymentId: p.id, member: { memberId: approver }, decision: 'approve', via: 'dashboard' });
    const result = await service.decidePayment({ paymentId: p.id, member: { memberId: approver }, decision: 'deny', via: 'dashboard' });
    expect(result.status).toBe('denied');
    await Promise.allSettled([service.decidePayment({ paymentId: p.id, member: { memberId: second }, decision: 'approve', via: 'app' })]);
    expect((await service.getPayment(p.id))?.status).toBe('denied');
    expect(fake.paymentWrites().filter(w => JSON.stringify(w.body).includes(p.id))).toHaveLength(0);
  });
  it('requires fresh approver authentication to grant', async () => {
    const input = { payeeId: null, category: 'utilities' as const, maxAmountCents: 50000, expiresAt: new Date(Date.now() + 3600000).toISOString() };
    await expect(grantAllowance(pool, sub, undefined, circleId, input)).rejects.toMatchObject({ code: 'step_up_required' });
    await expect(grantAllowance(pool, `${sub}-viewer`, Math.floor(Date.now()/1000), circleId, input)).rejects.toMatchObject({ code: 'permission_required' });
  });
  it('applies scope and cap, preserves scam holds, and stops auto-pay after revoke', async () => {
    const a = await grantAllowance(pool, sub, Math.floor(Date.now()/1000), circleId, {
      payeeId: null, category: 'utilities', maxAmountCents: 50000, expiresAt: new Date(Date.now()+3600000).toISOString(),
    });
    const paid = await service.createPayment(circleId, bill());
    expect(paid.status).toBe('paid');
    expect(paid.allowanceId).toBe(a.id);
    expect((await service.createPayment(circleId, bill(60000))).status).toBe('held');
    expect((await service.createPayment(circleId, bill(40000, true))).holdReasons).toContain('during_call');
    expect((await service.createPayment(circleId, { ...bill(), payeeName: 'Unknown utility' })).holdReasons).toContain('new_payee');
    await revokeAllowance(pool, sub, circleId, a.id);
    expect((await service.createPayment(circleId, bill())).status).toBe('held');
  });
  it('does not use expired allowances or a demoted grantor', async () => {
    const a = await grantAllowance(pool, sub, Math.floor(Date.now()/1000), circleId, {
      payeeId: null, category: 'utilities', maxAmountCents: 50000, expiresAt: new Date(Date.now()+3600000).toISOString(),
    });
    await pool.query("update allowances set expires_at = now() - interval '1 second' where id = $1", [a.id]);
    expect((await service.createPayment(circleId, bill())).status).toBe('held');
    await pool.query("update allowances set expires_at = now() + interval '1 hour' where id = $1", [a.id]);
    await pool.query("update circle_members set role = 'viewer' where id = $1", [approver]);
    expect((await service.createPayment(circleId, bill())).status).toBe('held');
    await pool.query("update circle_members set role = 'approver' where id = $1", [approver]);
  });
  it('an allowance cannot bypass the two-person threshold', async () => {
    await grantAllowance(pool, sub, Math.floor(Date.now()/1000), circleId, {
      payeeId: null, category: 'utilities', maxAmountCents: 200000, expiresAt: new Date(Date.now()+3600000).toISOString(),
    });
    const p = await service.createPayment(circleId, bill(150000));
    expect(p.status).toBe('held');
    expect(p.approvalsRequired).toBe(2);
    expect(p.allowanceId).toBeNull();
  });
  it('retains a bill due date, pays a known bill, and holds a new biller', async () => {
    const request = { ...bill(12300), billDueDate: '2026-11-20' };
    const p = await service.createPayment(circleId, request);
    expect(p.status).toBe('paid');
    expect(p.billDueDate).toBe('2026-11-20');
    const write = fake.paymentWrites().find(w => JSON.stringify(w.body).includes(p.id));
    expect(write?.body).toMatchObject({ recurring_date: 20, nickname: expect.stringContaining('due 2026-11-20') });
    expect((await service.createPayment(circleId, request)).id).toBe(p.id);
    await expect(service.createPayment(circleId, { ...request, billDueDate: '2026-11-21' })).rejects.toMatchObject({ code: 'idempotency_conflict' });
    const unknown = await service.createPayment(circleId, { ...request, idempotencyKey: crypto.randomUUID(), payeeName: 'New Biller' });
    expect(unknown.holdReasons).toContain('new_payee');
  });
});
