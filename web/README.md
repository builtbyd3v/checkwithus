# web/

The checkwith.us backend and family dashboard: Next.js App Router, TypeScript, Tailwind, deployed to Vercel at https://www.checkwith.us.
It holds the landing page, the family dashboard (`app/dashboard`), the iOS API (`app/api/v1`), the payment rules (`lib/rules.ts`) and the Tiger Data migrations (`db/migrations`).

```bash
npm install
cp .env.example .env.local   # fill in values; names and notes live in .env.example
npm run dev                  # http://localhost:3000
npm run preview:dashboard    # dashboard on synthetic data, no sign-in or database
```

Checks before a PR: `npm run typecheck && npm run lint && npm test && npm run build`.

API contract for the iOS app: [INTEGRATION.md](INTEGRATION.md). Project overview: [../README.md](../README.md).
