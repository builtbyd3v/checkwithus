# checkwith.us

Scam protection where the older adult does nothing and the family does the work.

Scam texts are filtered before they are read. Scam calls ring as "Possible scam".
Risky payments pause until a family member approves them. All scam detection runs
on the phone, so the older adult's texts and bills never leave the device.

Live at [checkwith.us](https://checkwith.us). Built at SwampHacks XII (Oct 16 to 18, 2026).

## How it works

One iPhone app serves both roles. On first launch it asks "I'm the one being
protected" or "I'm family". The web at checkwith.us is the landing page and the
family dashboard.

**The older adult does nothing new.**
- **Texts.** An iOS Message Filter extension runs our own on-device scam model (Guard tiny, 1 MB). Scam texts go to the Spam folder before they are read.
- **Calls.** A Call Directory extension labels known scam numbers "Possible scam" on the incoming call screen.
- **Payments.** The app has one big "Pay a bill" flow. Every payment goes to our server, which runs fixed code rules. A risky payment pauses, and the phone says the family will call. A lock-screen Live Activity updates when the family decides.
- **Help.** One big "Ask my family" button sends an alert to the family.
- **Bank while on a call.** The phone watches the nearest bank and ATM locations from Nessie. If the phone is inside one during a phone call, the family gets an alert. Scammers often keep a victim on the line and send them to the bank.

**The family does the work.**
- **Approve or deny** a held payment on the family iPhone app (approve needs Face ID) or on the dashboard. The family sees the amount, the payee and each hold reason in plain words.
- **Family circle.** Approvers decide; viewers only watch. Payments over a threshold (default $1,000) need two different approvers.
- **Freeze.** One tap moves the whole spending balance to a vault account with a Nessie transfer. New payments hold while frozen.
- **Allowances.** Approvers grant a scoped, expiring permission, for example "utilities up to $200 until Nov 30". Inside it, routine payments go through with no approval.
- **Explanation.** Apple's on-device model (Foundation Models) rewrites the true facts about a held payment into a short, calm note for the family. Code picks the facts; the model only rewords them.

**Hard rules.**
1. AI suggests, code decides money. The Guard score can add a hold reason and can never remove one ([`web/lib/rules.ts`](web/lib/rules.ts)).
2. Money is integer cents everywhere ([`web/lib/money.ts`](web/lib/money.ts)).
3. The older adult's texts and bills never go to a cloud AI model.

### What decides a hold

[`decideHold`](web/lib/rules.ts) is a pure function. A payment holds if any of these is true:

| Hold reason (as the family reads it) | Data behind it |
| --- | --- |
| Gift card purchase, Crypto purchase, Wire transfer | Payment category |
| Cash at an ATM, then a gift card. Scammers often ask for this. | Tiger Data time-window query: ATM cash in the last 2 hours |
| Someone they have not paid before | The family's known payee list |
| Over the limit you set | Circle limit (default: over $300) |
| Much more than they usually spend on this | Tiger Data continuous aggregate: more than 3x the typical day in that category |
| Paid while on a phone call | The phone's call state (CallKit) |
| Our scam check flagged it | On-device Guard score of 0.5 or more |
| Your family froze spending | The Freeze switch |

The landing page has a "Try a payment" widget that runs this same `decideHold` function in the browser.

### Sponsor tech doing real work

- **Capital One Nessie.** Customers and accounts (a spending account plus a vault account), merchants (payee categories), purchases and bills (every allowed payment is sent to Nessie), withdrawals and the ATM list (the "cash then gift card" sequence), deposits (history), transfers (Freeze and Unfreeze), and the ATM and branch lists (the bank-while-on-a-call alert). Client: [`web/lib/nessie/client.ts`](web/lib/nessie/client.ts).
- **Auth0.** Login for the dashboard. Native PKCE login in the family iPhone app. Signed API access tokens on every family route. Approver and viewer roles enforced on the server. A fresh login (no older than 5 minutes) before granting an allowance or changing roles. Client-Initiated Backchannel Authentication (CIBA, part of Auth0 for AI Agents) sends a Guardian push with the payment details as `authorization_details`. Code: [`web/lib/auth0/ciba.ts`](web/lib/auth0/ciba.ts), [`web/lib/auth/family.ts`](web/lib/auth/family.ts).
- **Tiger Data.** `spending` is a hypertable with columnstore compression (segment by circle). Real-time continuous aggregates (`spending_daily`, `spending_weekly` on top of it, and `spending_payee_daily`) feed the unusual-spending rule and the dashboard charts. A time-window query on the hypertable catches "ATM cash, then a gift card within 2 hours". Measured numbers are below.
- **GoDaddy Registry.** checkwith.us is our product name and our live domain.

## Status

What is merged on `main`, and what is still in review. Do not claim a feature as live until it is merged and deployed.

| Feature | Status |
| --- | --- |
| Message Filter with on-device Guard tiny | Merged; tested on a real iPhone |
| Call Directory "Possible scam" labels | Merged |
| Older adult app: pairing, Home, Pay a bill, held status, Live Activity, Ask my family | Merged |
| On-device explanation for the family (Foundation Models) | Merged |
| Web backend: payments, rules, Nessie, Auth0, Tiger Data, family API, dashboard | Merged |
| Roles, two-approval threshold, allowances (API) | Merged |
| CIBA Guardian push | Code merged and tested with a fake Auth0. TODO(Dev): confirm a real Guardian push and approval on the demo tenant, or keep "not verified live". |
| Family iPhone app: role picker, Face ID approvals, alerts, Freeze, allowances | In review, PR #30. TODO(Dev): update after merge. |
| Freeze (Nessie vault transfer) and "cash then gift card" hold | In review, PR #32. TODO(Dev): update after merge. |
| Weekly and per-payee continuous aggregates, 1M-row benchmark | In review, PR #31. TODO(Dev): update after merge. |
| Bank-while-on-a-call alert | In progress, branch `dev-25-bank-alert`. TODO(Dev): update after merge. |
| Landing page with "Try a payment" widget | In progress, branch `dev-landing`. TODO(Dev): update after merge. |

Known limits: alerts are not sent as Apple push notifications; the family app and dashboard read them when opened. The per-payee aggregate is built but not yet read by the rules. Nessie's reported account balance does not change after payments, so Tiger Data keeps the payment ledger.

## Model evaluation

Test set: real texts only (Mendeley, NCSU, UCI), with no near-duplicates of training rows. The threshold is set on the validation set. The 97% validation recall target (v2 and tiny) was picked after seeing one test result ([DECISIONS 26](ml/data/DECISIONS.md)), so those test numbers are slightly optimistic. "False holds" is the share of legit texts flagged as scam. Data report: [`ml/data/REPORT.md`](ml/data/REPORT.md).

| Model | Runs in | Size | Test n | Accuracy | Scam recall | False holds | Speed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Guard tiny: char + word n-grams, logistic regression** | Message Filter and app | 1 MB weights; 2.6 MB in the extension | 884 | 97.2% | 96.0% | 2.4% | **11 ms on iPhone 18 Pro Max** |
| Guard v2: DistilBERT, + toll and investment data | PyTorch reference | | 884 | 97.4% | 93.9% | 1.3% | |
| Guard v2, Core ML fp16 | Not shipped | 133.4 MB | 884 | | 93.6% | 1.3% | 1.3 ms per text on a Mac |
| Guard v2, Core ML 8-bit (`GuardInt8.mlpackage`) | Not shipped (too big for the filter) | 67 MB | 884 | | 94.0% | 1.1% | 1.3 ms per text on a Mac |
| Rules only (`ios/GuardKit/ScamRules.swift`, 9 rules) | Message Filter and app, with the model | | 884 | | 2.4% | 0.0% | |
| Rules + Core ML 8-bit, Swift end to end (`swift run guard-eval`) | Swift eval on a Mac | | 884 | | 94.0% | 1.1% | 1.4 ms per text on a Mac |
| Guard v1: DistilBERT, val target 95% (older test set) | PyTorch reference | | 878 | 97.6% | 98.4% | 2.7% | |

Probe set: 40 held-out synthetic toll and investment texts (no real ones exist in open data).

| Model | Toll and delivery recall (probe) | Investment recall (probe) | False holds (probe) |
| --- | --- | --- | --- |
| Guard tiny | 100% (n=15) | 13% (n=15) | 10% |
| Guard v2 | 100% (n=15) | 13% (n=15) | 0% |
| Rules only | | 47% | |
| Rules + Core ML, Swift | | 57% | |

Notes:
- v1 and v2 use slightly different test sets (the data changed), so compare with care.
- The Message Filter extension is killed above roughly 25 to 30 MB (measured with a probe on iOS 26). DistilBERT (67 MB) cannot run there, so the tiny model runs in the filter and in the app ([DECISIONS 27](ml/data/DECISIONS.md)). The DistilBERT Core ML scorer stays in GuardKit (`CoreMLScorer`) but the app does not ship it today.
- The 9 rules hold 0 of 6,382 legit texts across train, val and test. Legit "Toll Free" texts in test held by v2: 0 of 3.
- Weak spot: investment scams that open with "sorry, wrong number" (13% probe recall). The payment hold catches the money step instead.
- Mac speeds come from the export and Swift eval scripts. The iPhone speed and memory were measured by hand on one device.

Sources: [`ml/models/ngram_eval.json`](ml/models/ngram_eval.json), [`ml/models/guard/eval.json`](ml/models/guard/eval.json), [`ml/models/coreml_eval.json`](ml/models/coreml_eval.json), [`ml/data/DECISIONS.md`](ml/data/DECISIONS.md), and `guard-eval` output (recorded in commits `37439d6` and `589b791`). The v1 row is from `ml/models/guard/eval.json` at commit `07ecb35`.

## Tiger Data performance

Measured on Oct 17, 2026 on Tiger Cloud (TimescaleDB 2.30.2, PostgreSQL 18.6) with 1,000,000 synthetic rows in `spending` (200 circles, 40 payees each, 3 years). Server time from `explain (analyze, timing off)`, median of 21 warm runs after 3 warm-ups. Continuous aggregates fully materialized first.

| Query | Raw, row store (ms) | Raw, columnstore (ms) | Continuous aggregate (ms) | Aggregate vs row store |
| --- | ---: | ---: | ---: | ---: |
| Dashboard weekly chart (1 circle, 13 weeks) | 2.61 | 2.75 | 1.10 | 2.4x faster |
| Unusual-spending baseline (1 circle, 1 category, 90 days) | 2.57 | 3.00 | 1.18 | 2.2x faster |
| "Her usual" at one payee (1 circle, 1 year) | 7.92 | 8.55 | 2.65 | 3.0x faster |
| Weekly totals, all 200 circles, 3 years | 2077.43 | 1517.67 | 150.23 | 13.8x faster |

Compression (columnstore, segment by circle): 163.3 MB to 50.3 MB, **3.2x smaller** (158 of 158 chunks).

Aggregate times are a best case: everything was materialized, while in production the current week is computed live from raw rows. The queries are simplified versions of the dashboard and rules queries. Full method: [`docs/perf.md`](docs/perf.md) (PR #31). Reproduce with `npm run bench:perf` in `web/`, against a throwaway `wt_*` schema only.

## Setup

### Web (`web/`)

Needs Node.js, npm, a Nessie key, an Auth0 tenant and a Tiger Cloud service.

```bash
cd web
npm install
cp .env.example .env.local     # fill in the values; only names are in the repo
npm run check:auth0            # checks the Auth0 setup
npm run db:migrate             # applies web/db/migrations to Tiger Data
npm run seed:demo              # synthetic "Rosa" circle, payees, history, invite
npm run dev                    # http://localhost:3000
```

Checks: `npm run typecheck && npm run build && npm test`. Database tests: `npm run test:db`. More detail: [`web/INTEGRATION.md`](web/INTEGRATION.md).

### iPhone (`ios/`)

1. Open `ios/CheckWithUs/CheckWithUs.xcodeproj` in Xcode.
2. Set your signing team on the app and its three extensions (Message Filter, Call Directory, SafeCard).
3. Optional: put the demo caller's number in `CheckWithUs/scam-numbers.local.json` (gitignored).
4. Run on a real iPhone. Turn on the filter in Settings, Apps, Messages, Unknown and Spam. Turn on the call labels in Settings, Apps, Phone, Call Blocking and Identification.
5. Pair: make a pairing code in the dashboard, then type it on the older adult's phone.

GuardKit tests: `cd ios/GuardKit && swift test`.

### ML (`ml/`)

Python 3.12. Raw datasets go in `ml/data/raw/` (gitignored); sources and licenses are in [`ml/data/SOURCES.md`](ml/data/SOURCES.md).

```bash
python3.12 -m venv ml/.venv && ml/.venv/bin/pip install -r ml/requirements.txt
ml/.venv/bin/python -I ml/data/build.py && ml/.venv/bin/python -I ml/data/check.py
ml/.venv/bin/python -I ml/train_ngram.py     # Guard tiny, writes ngram_eval.json
ml/.venv/bin/python -I ml/train_guard.py     # Guard DistilBERT, writes guard/eval.json
ml/.venv/bin/python -I ml/export_coreml.py   # Core ML export, writes coreml_eval.json
```

## Repo layout

```
ios/    iPhone app (older adult and family), Message Filter, Call Directory, SafeCard Live Activity, GuardKit
web/    Next.js backend, family dashboard and landing page (Vercel)
ml/     datasets, training and eval scripts
docs/   plan, rules, demo script, Devpost and DEV drafts, perf numbers
```

Contributors and agents: read [AGENTS.md](AGENTS.md) first, then [docs/RULES.md](docs/RULES.md).

## AI tools used

Required by SwampHacks and MLH rules, and disclosed on Devpost. Each PR also names the tools it used.

| Tool | Used for |
| --- | --- |
| Claude Code (Opus 5, Opus 5.5) | Most code in `web/`, `ios/` and `ml/`: backend, Nessie and Auth0 integration, Tiger Data schema and benchmark, family-circle logic, dataset pipeline, training and eval scripts, Core ML export, GuardKit, iPhone app and extensions, landing page, and these docs. Haiku subagents searched for datasets; every license was then checked by hand. |
| Codex (GPT-6) | Continued the `web/` backend: approval and reconciliation fixes, the synthetic demo seed, and the family dashboard. |
| Codex CLI (read-only review) | Second-opinion review of changed files through a `Stop` hook, and review panels on the `ml/` dataset and the iPhone app. It found near-duplicate data leaks, label conflicts and several race conditions, which were then fixed. It reviews; a human and the authoring agent decide. |
| Apple Foundation Models (inside the product) | Runs on the phone and rewrites true facts into a short note for the family. It never decides anything. |

All code in this repository was written during the event window. The scam models
are trained by us; the project is not a reskin of an existing AI tool.

## Credits

Every third-party framework, library, API, model, dataset and font we use, with its
license. Required by Devpost rule 10 and [`docs/RULES.md`](docs/RULES.md).

### Services and APIs

| Service | Used for | Terms |
| --- | --- | --- |
| [Capital One Nessie](http://api.nessieisreal.com/) | Mock customers, accounts, merchants, purchases, bills, withdrawals, deposits, transfers, ATMs, branches | Capital One hackathon sandbox; mock data only |
| [Auth0](https://auth0.com/) | Family login, API tokens, roles, CIBA Guardian push | Auth0 free plan, developer terms |
| [Tiger Data / Tiger Cloud](https://www.tigerdata.com/) | Spending hypertable, compression, continuous aggregates | Tiger Cloud trial; TimescaleDB |
| [Vercel](https://vercel.com/) | Hosting for `web/` | Vercel Hobby terms |
| [GoDaddy Registry](https://registry.godaddy/) | `checkwith.us` domain | Registered with the MLH hackathon offer |

### `web/` dependencies

| Package | Version | License |
| --- | --- | --- |
| [next](https://github.com/vercel/next.js) | 16.4.2 | MIT |
| [react](https://github.com/facebook/react) | 19.3.0 | MIT |
| [react-dom](https://github.com/facebook/react) | 19.3.0 | MIT |
| [@auth0/nextjs-auth0](https://github.com/auth0/nextjs-auth0) | 4.32.1 | MIT |
| [jose](https://github.com/panva/jose) | 6.2.12 | MIT |
| [node-postgres (`pg`)](https://github.com/brianc/node-postgres) | 8.23.1 | MIT |
| [zod](https://github.com/colinhacks/zod) | 4.6.7 | MIT |
| [server-only](https://www.npmjs.com/package/server-only) | 0.0.1 | MIT |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 4.3.3 | MIT |
| [@tailwindcss/turbopack](https://github.com/tailwindlabs/tailwindcss) | 4.3.3 | MIT |
| [typescript](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 |
| [eslint](https://github.com/eslint/eslint) | 9.39.5 | MIT |
| [eslint-config-next](https://github.com/vercel/next.js) | 16.4.2 | MIT |
| [vitest](https://github.com/vitest-dev/vitest) | 5.0.5 | MIT |
| [tsx](https://github.com/privatenumber/tsx) | 4.23.15 | MIT |

Type definitions (`@types/node`, `@types/pg`, `@types/react`, `@types/react-dom`) come from
[DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) (MIT).

### Fonts

| Font | Used for | License |
| --- | --- | --- |
| [Geist and Geist Mono](https://vercel.com/font) | Web body text | SIL Open Font License 1.1 |
| [Newsreader](https://fonts.google.com/specimen/Newsreader) | Landing page headings | SIL Open Font License 1.1 |

Both are loaded with `next/font/google`.

### `ios/` frameworks

No third-party Swift packages. `ios/GuardKit` is our own package (WordPiece tokenizer, rules, n-gram and Core ML scorers). Apple frameworks only: SwiftUI, UIKit, Foundation, Core ML, IdentityLookup (Message Filter), CallKit (Call Directory and call state), ActivityKit and WidgetKit (Live Activity), Core Location (bank watch), Foundation Models (on-device explanation), AuthenticationServices (Auth0 login), LocalAuthentication (Face ID), Security and CryptoKit (Keychain, PKCE), os (logging), XCTest.

### `ml/` models and datasets

Full details, row counts and rejected sources: [`ml/data/SOURCES.md`](ml/data/SOURCES.md).

| Model or dataset | Used for | License |
| --- | --- | --- |
| [distilbert-base-uncased](https://huggingface.co/distilbert/distilbert-base-uncased) | Base model for Guard v1 and v2; its WordPiece vocab is bundled in GuardKit | Apache-2.0 |
| [SMS Phishing Dataset (Mishra and Soni, Mendeley)](https://data.mendeley.com/datasets/f45bkkt8pr/1) | Training and test data | CC BY 4.0 |
| [SMS phishing messages (NCSU WSPR lab)](https://github.com/wspr-ncsu/sms-phishing) | Training and test data | MIT |
| [SMS Spam Collection (UCI)](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) | Training and test data | CC BY 4.0 |
| [AI-in-the-Loop SSD (SUPREME Lab)](https://github.com/supreme-lab/ai-in-the-loop) | Training data (scam call scripts) | MIT |
| [CloveAI/india-spam-sms](https://huggingface.co/datasets/CloveAI/india-spam-sms) | Training data (hard negatives) | MIT |

Guard tiny is trained from scratch on the same data; it has no base model.

| Python package | Version | License |
| --- | --- | --- |
| [pandas](https://github.com/pandas-dev/pandas) | 2.2.3 | BSD-3-Clause |
| [pyarrow](https://github.com/apache/arrow) | 18.1.0 | Apache-2.0 |
| [torch](https://github.com/pytorch/pytorch) | 2.4.1 | BSD-3-Clause |
| [transformers](https://github.com/huggingface/transformers) | 4.46.3 | Apache-2.0 |
| [coremltools](https://github.com/apple/coremltools) | 8.1 | BSD-3-Clause |
| [numpy](https://github.com/numpy/numpy) | installed with pandas and torch | BSD-3-Clause |

## Demo data

Demo data uses fake people only. No real person's name, phone number, bank
details or messages appear in this repository or in the demo. The demo person is
"Rosa CheckWith (synthetic)". Scam numbers in the repo are fictional 555-01xx numbers.

Exception: `ml/data/` contains published, openly licensed research SMS datasets
(listed in Credits) used to train and test the scam model. They are never shown
in the demo. Our own synthetic rows use fake names, 555 numbers and made-up domains.
