# checkwith.us

Scam protection where the older adult does nothing and the family does the work.

Scam texts are filtered before they are read, scam calls ring as "Possible scam,"
and risky payments pause until a family member approves them with Face ID. All
scam detection runs on the phone — the older adult's texts and bills never leave
the device.

Built at SwampHacks XII (Oct 16–18, 2026).

## Repo layout

```
ios/    older adult app, family app, Message Filter + Call Directory extensions
web/    Next.js backend + family dashboard (Vercel)
ml/     datasets, training, eval scripts, exported models
docs/   rules, Devpost write-up, demo script, research
```

Contributors and agents: read [AGENTS.md](AGENTS.md) first, then
[docs/RULES.md](docs/RULES.md).

## Model evaluation

<!-- Dev owns this table: one row per trained model (accuracy, scam recall,
     false holds, on-iPhone latency). See AGENTS.md. -->

_To be added._

## AI tool disclosure

Required by SwampHacks and MLH rules, and disclosed on Devpost.

| Tool | Used for |
| --- | --- |
| Claude Code (Opus 5) | `web/` backend and dashboard: scaffolding, Nessie and Auth0 integration, family-circle logic, Tiger Data schema. Each PR notes the tools used. |
| Codex CLI | Independent second-opinion review of changed files via a `Stop` hook. Read-only; it reviews, a human and the authoring agent decide. |
| Codex (GPT-6) | Continued the `web/` backend: approval and reconciliation fixes, synthetic demo seed, and family dashboard. |

All code in this repository was written during the event window. The on-device
models are fine-tuned by us; the project is not a reskin of an existing AI tool.

## Credits

Every third-party framework, library, API, model and dataset we use, with its
license. Required by Devpost rule 10 and `docs/RULES.md`.

### Services and APIs

| Service | Used for | Terms |
| --- | --- | --- |
| [Capital One Nessie](http://api.nessieisreal.com/) | Mock accounts, merchants, bills, transfers | Capital One hackathon sandbox; mock data only |
| [Auth0](https://auth0.com/) | Family member identity and payment approval | Auth0 free plan, developer terms |
| [Tiger Data / Tiger Cloud](https://www.tigerdata.com/) | Spending history, continuous aggregates, dashboard | Tiger Cloud trial; TimescaleDB extension |
| [Vercel](https://vercel.com/) | Hosting for `web/` | Vercel Hobby terms |
| [GoDaddy Registry](https://registry.godaddy/) | `checkwith.us` domain | Registered via MLH hackathon offer |

### `web/` dependencies

| Package | Version | License |
| --- | --- | --- |
| [next](https://github.com/vercel/next.js) | 16.4.2 | MIT |
| [react](https://github.com/facebook/react) | 19.3.0 | MIT |
| [react-dom](https://github.com/facebook/react) | 19.3.0 | MIT |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 4.3.3 | MIT |
| [typescript](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 |
| [eslint](https://github.com/eslint/eslint) | 9.39.5 | MIT |
| [node-postgres (`pg`)](https://github.com/brianc/node-postgres) | 8.23.1 | MIT |
| [zod](https://github.com/colinhacks/zod) | 4.6.7 | MIT |
| [jose](https://github.com/panva/jose) | 6.2.12 | MIT |
| [server-only](https://www.npmjs.com/package/server-only) | 0.0.1 | MIT |
| [vitest](https://github.com/vitest-dev/vitest) | 5.0.5 | MIT |
| [@auth0/nextjs-auth0](https://github.com/auth0/nextjs-auth0) | 4.32.1 | MIT |
| [tsx](https://github.com/privatenumber/tsx) | 4.23.15 | MIT |

Type definitions (`@types/*`) come from
[DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) (MIT).

### `ml/` models and datasets

<!-- Dev + data teammate: list each base model with its license (DistilBERT,
     Qwen3.5-2B), and every dataset with its source URL and license. Per
     docs/RULES.md rule 3, dataset sources also go in ml/data/SOURCES.md.
     Confirm each license permits fine-tuning and demo use. -->

_To be added._

### `ios/` dependencies

<!-- Dev: list any third-party Swift packages, or state that there are none. -->

_To be added._

## Demo data

Demo data uses fake people only. No real person's name, phone number, bank
details or messages appear in this repository or in the demo.
