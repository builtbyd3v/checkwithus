/**
 * Server configuration, validated on first use.
 *
 * Split by service so one missing variable fails only the feature that needs
 * it: a typo in an Auth0 setting must not stop a bill from being paid.
 * Validation is lazy so `next build` works without secrets present.
 *
 * Error messages name the variable and what is wrong with it, never its value.
 */
import 'server-only';
import { z } from 'zod';

/** An unset variable and `NAME=` (empty) both mean "not provided". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema);

const required = z.string().min(1, 'is required');

function memo<T>(load: () => T): () => T {
  let cached: { value: T } | undefined;
  return () => (cached ??= { value: load() }).value;
}

function parse<T>(section: string, schema: z.ZodType<T>): T {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')} ${issue.message}`)
      .join('; ');
    throw new Error(
      `Invalid ${section} configuration: ${problems}. Variable names and formats are in web/.env.example.`,
    );
  }
  return result.data;
}

export const dbEnv = memo(() =>
  parse(
    'database',
    z.object({
      DATABASE_URL: z
        .string()
        .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL (not a psql command)'),
    }),
  ),
);

/** Key for hashing short codes (see hashShortCode). Generate with:
 *  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" */
export const codeHashKey = memo(
  () =>
    parse(
      'code hashing',
      z.object({
        CODE_HASH_KEY: z
          .string()
          .min(32, 'must be at least 32 characters of random data (see lib/env.ts)'),
      }),
    ).CODE_HASH_KEY,
);

export const nessieEnv = memo(() =>
  parse('Nessie', z.object({ NESSIE_API_KEY: required })),
);

export const auth0Env = memo(() =>
  parse(
    'Auth0',
    z.object({
      AUTH0_DOMAIN: z
        .string()
        .regex(
          /^[a-z0-9.-]+$/i,
          'must be a bare hostname like tenant.us.auth0.com (no https://, no trailing slash)',
        ),
      AUTH0_CLIENT_ID: required,
      AUTH0_CLIENT_SECRET: required,
      AUTH0_AUDIENCE: required,
      /** `true`: CIBA pushes carry payment details (RAR). Needs the type registered on the API. */
      AUTH0_CIBA_RAR: optional(z.enum(['true', 'false']).default('false')),
    }),
  ),
);

export const appEnv = memo(() =>
  parse(
    'app',
    z.object({
      APP_BASE_URL: z.url('must be a full URL such as https://checkwith.us'),
      /** Family has this long to answer before a held payment is blocked. CIBA caps it at 300. */
      APPROVAL_TIMEOUT_SECONDS: optional(z.coerce.number().int().min(30).max(300).default(300)),
      /** `app`: family app calls us after Face ID. `ciba`: Auth0 CIBA push. */
      APPROVAL_MODE: optional(z.enum(['app', 'ciba']).default('app')),
      /** Calendar dates sent to Nessie are in this zone. SwampHacks is in Gainesville. */
      DEMO_TIMEZONE: optional(
        z
          .string()
          .default('America/New_York')
          .refine(isTimeZone, 'must be an IANA time zone such as America/New_York'),
      ),
    }),
  ),
);

function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
