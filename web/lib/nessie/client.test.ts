import { describe, expect, it } from 'vitest';
import { createNessieClient, NessieError } from './client';

const KEY = 'secret-key-abc123';

/** A fake fetch that answers from a script and records every call. */
function scripted(responses: Array<Response | Error>) {
  const calls: Array<{ url: string; method: string }> = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, method: String(init.method) });
    const next = responses.shift();
    if (!next) throw new Error('no scripted response left');
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const noSleep = async () => {};

describe('writes', () => {
  it('never retries a POST, because it may already have paid', async () => {
    const { fetch, calls } = scripted([json(500, { message: 'boom' }), json(201, {})]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });

    const error = await client.createPurchase('acct', {}).catch((e: unknown) => e);

    expect(calls).toHaveLength(1);
    expect(error).toBeInstanceOf(NessieError);
    expect((error as NessieError).outcomeUnknown).toBe(true);
  });

  it('knows a 4xx means nothing was created', async () => {
    const { fetch } = scripted([json(400, 'merchant_id field required')]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });

    const error = (await client.createPurchase('acct', {}).catch((e: unknown) => e)) as NessieError;

    expect(error.outcomeUnknown).toBe(false);
    expect(error.status).toBe(400);
    expect(error.message).toContain('merchant_id field required');
  });

  it('treats a timeout on a write as an unknown outcome', async () => {
    const { fetch, calls } = scripted([new Error('timeout')]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });

    const error = (await client.createBill('acct', {}).catch((e: unknown) => e)) as NessieError;

    expect(calls).toHaveLength(1);
    expect(error.outcomeUnknown).toBe(true);
  });

  it('treats any 2xx without an id as a possible payment, not a failure', async () => {
    const { fetch } = scripted([json(202, { message: 'Accepted' })]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });

    const error = (await client.createPurchase('acct', {}).catch((e: unknown) => e)) as NessieError;

    expect(error.outcomeUnknown).toBe(true);
  });

  it('treats an unreadable response to a write as an unknown outcome', async () => {
    const broken = {
      status: 201,
      text: () => Promise.reject(new Error('stream broke')),
    } as unknown as Response;
    const { fetch } = scripted([broken]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });

    const error = (await client.createWithdrawal('acct', {}).catch((e: unknown) => e)) as NessieError;

    expect(error).toBeInstanceOf(NessieError);
    expect(error.outcomeUnknown).toBe(true);
  });

  it('returns the new id on success', async () => {
    const { fetch } = scripted([json(201, { code: 201, objectCreated: { _id: 'new-id' } })]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });
    await expect(client.createCustomer({})).resolves.toBe('new-id');
  });
});

describe('reads', () => {
  it('retries a GET through transient failures', async () => {
    const { fetch, calls } = scripted([json(503, {}), new Error('reset'), json(200, [])]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });

    await expect(client.listMerchants()).resolves.toEqual([]);
    expect(calls).toHaveLength(3);
  });

  it('gives up after two retries', async () => {
    const { fetch, calls } = scripted([json(503, {}), json(503, {}), json(503, {})]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });

    await expect(client.listMerchants()).rejects.toBeInstanceOf(NessieError);
    expect(calls).toHaveLength(3);
  });

  it('treats a 404 list as an error, never as "empty"', async () => {
    // Otherwise a bad account id would read as "this payment never reached Nessie".
    const { fetch } = scripted([json(404, { message: 'Account not found' })]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });
    await expect(client.findRecordForPayment('bad-id', 'p')).rejects.toBeInstanceOf(NessieError);
  });

  it('returns account balances in cents, not Nessie dollars', async () => {
    const { fetch } = scripted([
      json(200, [
        // Shape copied from a live GET /customers/{id}/accounts response.
        {
          _id: '19b1e8d8-04fb-4c29-ba2b-0f1c767e0c68',
          type: 'Checking',
          nickname: 'Probe checking',
          rewards: 0,
          balance: 1000,
          account_number: '2365362338310243',
          customer_id: '11b22cc7-9478-44d2-818c-f796c8bcbff5',
        },
      ]),
    ]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });
    const [account] = await client.listCustomerAccounts('c');
    expect(account).toMatchObject({ openingBalanceCents: 100_000, type: 'Checking' });
    expect(account).not.toHaveProperty('balance');
  });

  it('refuses a response that does not match the expected shape', async () => {
    const { fetch } = scripted([json(200, [{ unexpected: true }])]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });
    await expect(client.listCustomers()).rejects.toBeInstanceOf(NessieError);
  });
});

describe('the API key', () => {
  it('goes only in the query string', async () => {
    const { fetch, calls } = scripted([json(200, [])]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });
    await client.listCustomers();
    expect(calls[0]!.url).toBe(`https://api.nessieisreal.com/customers?key=${KEY}`);
  });

  it('never appears in an error, even when the network error quotes the URL', async () => {
    const leaky = new Error(`connect failed: https://api.nessieisreal.com/customers?key=${KEY}`);
    const { fetch } = scripted([leaky, leaky, leaky]);
    const client = createNessieClient({ key: KEY, fetch, sleep: noSleep });

    const error = (await client.listCustomers().catch((e: unknown) => e)) as Error;

    expect(error.message).not.toContain(KEY);
    expect(String(error.stack)).not.toContain(KEY);
  });
});
