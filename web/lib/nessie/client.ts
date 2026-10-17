/**
 * Nessie HTTP client. Transport only: every body it sends is built by, and
 * every response it returns is parsed by, `./format.ts`.
 *
 * The API key travels in the query string, so a URL must never reach an error
 * message or a log. Errors carry the method, the path and the status only.
 *
 * Retries: GETs retry twice on network errors, 429 and 5xx. Writes never retry.
 * A payment POST that timed out may already have succeeded at Nessie, and
 * retrying it is how a payment gets made twice. A failed write instead reports
 * whether its outcome is unknown, and the caller reconciles by looking for the
 * payment's tag (see `findRecordForPayment`).
 */
import 'server-only';
import type { z } from 'zod';
import { nessieEnv } from '@/lib/env';
import {
  accountListSchema,
  accountSchema,
  bankLocationListSchema,
  billListSchema,
  createdSchema,
  customerListSchema,
  fromAccount,
  fromBankLocation,
  fromBill,
  fromMovement,
  fromPurchase,
  merchantListSchema,
  movementListSchema,
  purchaseListSchema,
  type NessieAccount,
  type NessieRecord,
} from './format';

export const NESSIE_BASE_URLS = ['https://api.nessieisreal.com', 'https://prod-api.nessieisreal.com'] as const;
const TIMEOUT_MS = 10_000;
const GET_RETRIES = 2;

export class NessieError extends Error {
  /**
   * True when a write may have reached Nessie anyway (timeout, network error,
   * 5xx). False when Nessie definitely rejected it (4xx) or it was a read.
   */
  readonly outcomeUnknown: boolean;

  constructor(
    readonly method: string,
    /** Path only, never the query string, so never the key. */
    readonly path: string,
    readonly status: number | null,
    detail: string,
  ) {
    super(`Nessie ${method} ${path} failed${status === null ? '' : ` (${status})`}: ${detail}`);
    this.name = 'NessieError';
    this.outcomeUnknown = method !== 'GET' && (status === null || status >= 500);
  }
}

type Method = 'GET' | 'POST' | 'DELETE';
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type NessieClientOptions = {
  key: string;
  baseUrl?: typeof NESSIE_BASE_URLS[number];
  fetch?: FetchLike;
  /** Injected by tests so retries do not actually sleep. */
  sleep?: (ms: number) => Promise<void>;
};

export function createNessieClient(options: NessieClientOptions) {
  if (!options.key) throw new Error('Nessie API key is empty');
  const baseUrl = options.baseUrl ?? NESSIE_BASE_URLS[0];
  if (!NESSIE_BASE_URLS.includes(baseUrl)) throw new Error('Unsupported Nessie host');
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  async function request(method: Method, path: string, body?: unknown) {
    const url = `${baseUrl}${path}?key=${encodeURIComponent(options.key)}`;
    const attempts = method === 'GET' ? 1 + GET_RETRIES : 1;

    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await doFetch(url, {
          method,
          headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
          redirect: 'error',
        });
      } catch {
        // The original error can contain the URL, and with it the key: drop it.
        if (attempt < attempts) {
          await sleep(300 * 3 ** (attempt - 1));
          continue;
        }
        throw new NessieError(method, path, null, 'network error or timeout');
      }

      if ((response.status >= 500 || response.status === 429) && attempt < attempts) {
        await sleep(300 * 3 ** (attempt - 1));
        continue;
      }

      let text: string;
      try {
        text = await response.text();
      } catch {
        // The request reached Nessie; for a write we cannot know what it did.
        throw new NessieError(method, path, null, 'response body could not be read');
      }
      let json: unknown = text;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // Nessie answers validation errors as a JSON string; keep raw text otherwise.
      }
      return { status: response.status, json };
    }
  }

  async function create(path: string, body: unknown): Promise<string> {
    const { status, json } = await request('POST', path, body);
    if (status < 200 || status >= 300) {
      throw new NessieError('POST', path, status, detailOf(json));
    }
    const parsed = createdSchema.safeParse(json);
    if (!parsed.success) {
      // Any 2xx means something was probably created; we just cannot see its id.
      // A null status marks the outcome unknown so the caller reconciles.
      throw new NessieError('POST', path, null, `answered ${status} without an id`);
    }
    return parsed.data.objectCreated._id;
  }

  async function list<T>(path: string, schema: z.ZodType<T[]>): Promise<T[]> {
    const { status, json } = await request('GET', path);
    // A 404 is an error, never "empty". Every list we read answers an empty
    // result with 200 [] (verified live). Reading 404 as empty would let a bad
    // account id look like "this payment never reached Nessie", which is
    // exactly the answer that leads to paying twice.
    if (status !== 200) throw new NessieError('GET', path, status, detailOf(json));
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new NessieError('GET', path, status, 'response did not match the expected shape');
    }
    return parsed.data;
  }

  const account = (id: string) => `/accounts/${encodeURIComponent(id)}`;

  async function listRecords(accountId: string): Promise<NessieRecord[]> {
    const at = account(accountId);
    const [purchases, withdrawals, deposits, bills] = await Promise.all([
      list(`${at}/purchases`, purchaseListSchema),
      list(`${at}/withdrawals`, movementListSchema),
      list(`${at}/deposits`, movementListSchema),
      list(`${at}/bills`, billListSchema),
    ]);
    return [
      ...purchases.map(fromPurchase),
      ...withdrawals.map((w) => fromMovement(w, 'withdrawal')),
      ...deposits.map((d) => fromMovement(d, 'deposit')),
      ...bills.map(fromBill),
    ];
  }

  /**
   * The Nessie record a payment produced, if it got there. Used after a write
   * whose outcome is unknown, so "did it go through?" is answered by looking,
   * not by trying again.
   */
  async function findRecordForPayment(accountId: string, paymentId: string) {
    const records = await listRecords(accountId);
    return records.find((r) => r.paymentId === paymentId) ?? null;
  }

  return {
    listAtms: async () => (await list('/atms', bankLocationListSchema)).map((location) => fromBankLocation(location, 'atm')),
    listBranches: async () => (await list('/branches', bankLocationListSchema)).map((location) => fromBankLocation(location, 'branch')),
    getAccount: async (id: string): Promise<NessieAccount> => {
      const path = account(id);
      const { status, json } = await request('GET', path);
      if (status !== 200) throw new NessieError('GET', path, status, detailOf(json));
      const parsed = accountSchema.safeParse(json);
      if (!parsed.success) throw new NessieError('GET', path, status, 'response did not match the expected shape');
      return fromAccount(parsed.data);
    },
    listCustomers: () => list('/customers', customerListSchema),
    createCustomer: (body: unknown) => create('/customers', body),

    listCustomerAccounts: async (customerId: string): Promise<NessieAccount[]> =>
      (
        await list(`/customers/${encodeURIComponent(customerId)}/accounts`, accountListSchema)
      ).map(fromAccount),
    createAccount: (customerId: string, body: unknown) =>
      create(`/customers/${encodeURIComponent(customerId)}/accounts`, body),

    listMerchants: () => list('/merchants', merchantListSchema),
    createMerchant: (body: unknown) => create('/merchants', body),

    createPurchase: (accountId: string, body: unknown) =>
      create(`${account(accountId)}/purchases`, body),
    createWithdrawal: (accountId: string, body: unknown) =>
      create(`${account(accountId)}/withdrawals`, body),
    createDeposit: (accountId: string, body: unknown) =>
      create(`${account(accountId)}/deposits`, body),
    createBill: (accountId: string, body: unknown) => create(`${account(accountId)}/bills`, body),

    listRecords,
    findRecordForPayment,
  };
}

export type NessieClient = ReturnType<typeof createNessieClient>;

let shared: NessieClient | undefined;

/** The app's client, keyed from the environment. */
export function nessie(): NessieClient {
  return (shared ??= createNessieClient({ key: nessieEnv().NESSIE_API_KEY }));
}

/** Nessie's own error text, shortened. It never contains our key. */
function detailOf(json: unknown): string {
  const text =
    typeof json === 'string'
      ? json
      : json && typeof json === 'object' && 'message' in json
        ? String(json.message)
        : 'unexpected response';
  return text.replace(/\s+/g, ' ').slice(0, 200);
}
