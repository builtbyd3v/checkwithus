# checkwith.us

Scam protection where the older adult does nothing and the family does the work.

Scam texts are filtered before they are read. Scam calls ring as "Possible scam".
Risky payments pause until a family member approves them. All scam detection runs
on the phone. The older adult's texts and bills never go to a cloud AI model;
payment details go to our backend and Nessie for rule checks and payment processing.

Live at [checkwith.us](https://checkwith.us). Built at SwampHacks XII (Oct 16 to 18, 2026).

> **Build scope:** This README describes the development code preserved on `rishon` in draft PR #54. Main was intentionally restored through #53. The branch is not claimed to be deployed or live-verified.
>
> Before submission, verify the same reviewed build on real iPhones and the server, apply its migrations, confirm the live Auth0/Nessie setup, check dataset licenses, and publish the video, DEV post and Devpost entry. Guardian and the bill agent have additional tenant setup; their live behavior remains unverified here.

## How it works

One iPhone app serves both roles. On first launch it asks "I'm the one being
protected" or "I'm family". The web at checkwith.us is the landing page and the
family dashboard.

**The older adult does nothing new.**
- **Texts.** An iOS Message Filter extension runs our own on-device scam model (Guard tiny, 1 MB). Scam texts go to the Spam folder before they are read.
- **Calls.** A Call Directory extension labels known scam numbers "Possible scam" on the incoming call screen.
- **Payments.** The app has one big "Pay a bill" flow. Every payment goes to our server, which runs fixed code rules. A risky payment pauses, and the phone says the family will call. A lock-screen Live Activity shows the state; it updates while the app polls the server (in the foreground, or for a short time in the background), not by push.
- **Help.** One big "Ask my family" button sends an alert to the family.
- **Bank while on a call.** The phone watches the nearest bank and ATM locations from Nessie, plus any demo locations the server adds (`DEMO_BANK_LOCATIONS`). If the phone is inside one during a phone call, the family gets an alert with the bank's name, never the phone's location. Scammers often keep a victim on the line and send them to the bank.
- **Accessibility.** Tested at the largest accessibility text size: pinned buttons on an opaque bar, no mid-word breaks, VoiceOver announces the real outcome, darker colors for contrast, 56 pt tap targets, and Reduce Motion stops the waiting pulse.

**The family does the work.**
- **Approve or deny** a held payment on the family iPhone app or the dashboard. The family sees the amount, the payee and each hold reason in plain words. On the phone, Approve first asks for Face ID or the passcode; that check runs on the phone. The server checks the approver's Auth0 token and circle role (and the `approve:payments` permission when `AUTH0_RBAC=true`). Deny needs no Face ID, because denying only stops money. TODO(Dev): today a phone with no passcode skips the check; keep this caveat until the no-passcode fix merges.
- **Family circle.** Approvers decide; viewers only watch. Over a threshold (default $1,000), two approvers must say yes; one no stops it.
- **Freeze.** One tap moves the whole spending balance to a vault account with one Nessie transfer, exactly once. New payments hold while frozen.
- **Top up.** An approver adds money from their own Nessie account with one transfer ($1 to $10,000, whole dollars, fresh login, not while frozen). The API is built; the iPhone app has no top-up screen yet.
- **Allowances.** Approvers grant a scoped, expiring permission, for example "utilities up to $400 until Nov 30". Inside it, a known payee can be paid over the usual limit with no approval. It never lifts gift card, crypto, wire, new payee, phone call or scam-check holds. The allowance is stored in our database (Tiger Data), granted after a fresh Auth0 login.
- **Alerts.** "Ask my family" and "at a bank during a call" alerts show in the family app and on the dashboard, newest first. The family app polls every 10 seconds; there are no push notifications yet.
- **Explanation.** Apple's on-device model (Foundation Models) rewrites the true facts about a held payment into a short, calm note for the family. Code picks the facts; the note is dropped if it loses one.
- **Dashboard.** Waiting payments with "About Nx Rosa's usual at this payee", a weekly spending chart, the alerts list, and a "How fast this page is" card that times the real weekly query on the aggregate and on raw rows.

**Hard rules.**
1. AI suggests, code decides money. The Guard score can add a hold reason and can never remove one ([`web/lib/rules.ts`](web/lib/rules.ts)).
2. Money is integer cents everywhere ([`web/lib/money.ts`](web/lib/money.ts)).
3. The older adult's texts and bills never go to a cloud AI model.

### What decides a hold

[`decideHold`](web/lib/rules.ts) is a pure function. A payment holds if any of these is true:

| Hold reason (as the family reads it) | Data behind it |
| --- | --- |
| Your family froze spending | The Freeze switch |
| Gift card purchase, Crypto purchase, Wire transfer | Payment category |
| Cash at an ATM, then a gift card. Scammers often ask for this. | Tiger Data time-window query: ATM cash in the last 2 hours |
| Someone they have not paid before | The family's known payee list |
| Over the limit you set | Circle limit (default: over $300) |
| Much more than they usually spend on this | Tiger Data continuous aggregate `spending_daily`: more than 3x the typical day in that category |
| Paid while on a phone call | The phone's call state (CallKit) |
| Our scam check flagged it | On-device Guard score of 0.5 or more |

The landing page has a "Try a payment" widget that runs this same `decideHold` function in the browser.

### Bill-pay agent

Rosa's bill-pay agent has its own Auth0 identity: a Machine-to-Machine app that signs in with the client credentials grant. Its token holds one scope, `pay:bills`.
- **It can only ask.** `npm run agent:bills` calls `POST /api/v1/agent/bills/run`. For each known biller it proposes the next bill (due one month after the last one, for the last amount). That is a fixed rule with no AI model, and bill data never leaves our server except to Nessie.
- **The same rules decide.** Every proposal goes through `createPayment`, the same path as the phone. Inside a live family allowance it pays with no push. Outside it, the payment is held and the family is asked once (family app, or a Guardian push with `APPROVAL_MODE=ciba`). It never pays a cycle twice and never asks again after a no.
- **Least privilege.** It acts only in circles with a live allowance. The route checks RS256, our issuer and audience, `gty = client-credentials`, the agent's own `sub`, and `pay:bills`. Every family route rejects machine tokens (`403 agent_not_allowed`), so the agent can never approve, deny, freeze, unfreeze, grant allowances or change policy. Revoking the allowance stops it.
- **Visible.** Each agent payment stores `initiated_by = 'agent'`; the dashboard shows "Paid by the bill agent under your Utilities allowance" or "Asked by the bill agent".

TODO(Dev): the real M2M grant is not verified on the live Auth0 tenant yet. Create the M2M app with only `pay:bills`, set `AUTH0_AGENT_CLIENT_ID`, run `npm run agent:bills -- --within 14` once, then delete this line. Until then, say "tested against a fake Auth0".

### Sponsor tech doing real work

- **Capital One Nessie.** Each endpoint has a job. Customers and accounts: a spending account and a vault account. Merchants: payee categories. Purchases and bills: every allowed payment is sent to Nessie. Withdrawals and ATMs: the "cash then gift card" sequence. Transfers: Freeze, Unfreeze and the family top-up. Deposits: the seed writes Rosa's monthly pension as Nessie deposits, which add to her ledger balance. ATMs and branches: the bank-while-on-a-call alert. Nessie never updates its stored balance, so the available balance is our ledger minus reserved payments; Nessie's reported balance is shown for information. Client: [`web/lib/nessie/client.ts`](web/lib/nessie/client.ts).
- **Auth0.** Login for the dashboard and native PKCE login in the family iPhone app. Signed API access tokens on every family route. Approver and viewer roles enforced on the server, plus an opt-in `approve:payments` RBAC permission (`AUTH0_RBAC=true`). A fresh login (no older than 5 minutes) before granting an allowance, changing roles, unfreezing or topping up. The bill-pay agent is its own Machine-to-Machine client with only `pay:bills`, and family routes reject machine tokens. Client-Initiated Backchannel Authentication (CIBA, part of Auth0 for AI Agents) is implemented: with `APPROVAL_MODE=ciba`, a held payment sends a Guardian push. With `AUTH0_CIBA_RAR=true` as well, the push carries the amount, payee and hold reasons as rich `authorization_details`. Both are off by default, tested only against a fake Auth0, and a live push is not verified. We fixed a bug where the push always sent `audience`, which the real tenant rejects. Code: [`web/lib/auth0/ciba.ts`](web/lib/auth0/ciba.ts), [`web/lib/auth/family.ts`](web/lib/auth/family.ts).
- **Tiger Data.** `spending` is a hypertable with columnstore compression (segment by circle). Real-time continuous aggregates do the reading: `spending_daily` feeds the unusual-spending rule; `spending_weekly`, built on top of it, feeds the dashboard's weekly chart; `spending_payee_daily` feeds the dashboard's "About Nx usual" line (display only; it does not decide holds). A time-window query on the hypertable catches "ATM cash, then a gift card within 2 hours". The dashboard speed card times the weekly query live; the 1M-row numbers are below.
- **GoDaddy Registry.** checkwith.us is our product name and our live domain.

Design notes for the older adult screens: [`docs/design-principles.md`](docs/design-principles.md), with sources in [`docs/research.md`](docs/research.md) and screenshots in [`docs/gallery/`](docs/gallery/).

Known limits: no push notifications (alerts and the lock-screen card update by polling). The allowance lives in our database, not in Auth0. No usability test with older adults yet.

## Model evaluation

Test set: 884 real texts (248 scam, 636 legit) from Mendeley, NCSU and UCI, with no near-duplicates of training rows. The threshold is set on the validation set. The 97% validation recall target (v2 and tiny) was picked after seeing one test result ([DECISIONS 26](ml/data/DECISIONS.md)), so those test numbers are slightly optimistic. "False holds" is the share of legit texts flagged as scam. Data report: [`ml/data/REPORT.md`](ml/data/REPORT.md).

The app ships only Guard tiny (`NGramScorer`), in the Message Filter and in the app. Guard v2 (DistilBERT) is trained and evaluated but not shipped: at 67 MB it does not fit in the Message Filter.

| Model | Shipped | Size | Test n | Accuracy | Scam recall | False holds | Mac speed per text |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Guard tiny: char + word n-grams, logistic regression** | **Yes** | 1 MB weights; 2.6 MB in the extension | 884 | 97.2% | 96.0% | 2.4% | 0.14 ms (Swift, with rules) |
| Guard v2: DistilBERT, + toll and investment data (PyTorch) | No | | 884 | 97.4% | 94.0% | 1.3% | |
| Guard v2, Core ML fp16 | No | 133.4 MB | 884 | | 93.5% | 1.3% | 1.3 ms |
| Guard v2, Core ML 8-bit (`GuardInt8.mlpackage`) | No | 67 MB | 884 | | 94.0% | 1.1% | 1.50 ms (Swift, with rules) |
| Rules only (`ios/GuardKit/ScamRules.swift`, 10 rules) | Yes, with Guard tiny | | 884 | | 3.6% | 0.0% | |
| Guard v1: DistilBERT, val target 95% (older test set) | No | | 878 | 97.6% | 98.4% | 2.7% | |

Adding the 10 rules to either model changes nothing on this test set (same recall and false holds in `guard-eval`).

Probe set: the first 40-row probe of held-out synthetic texts (15 toll and delivery scams, 15 investment scams, 10 legit), because no real ones exist in open data. The current 85-row `probe.csv` is under "Investment scams" below.

| Model | Scam recall (30) | Toll and delivery (15) | Investment (15) | False holds (10) |
| --- | --- | --- | --- | --- |
| Guard tiny | 56.7% | 100% | 13% | 10% |
| Guard v2 (PyTorch) | 56.7% | 100% | 13% | 0% |
| Rules only | 46.7% | | | 0% |
| Rules + Guard v2 Core ML 8-bit, Swift | 56.7% | | | 0% |

Notes:
- v1 and v2 use slightly different test sets (the data changed), so compare with care.
- The Message Filter extension is killed above roughly 25 to 30 MB (measured with a probe on iOS 26), so DistilBERT cannot run there ([DECISIONS 27](ml/data/DECISIONS.md)). The DistilBERT Core ML scorer stays in GuardKit (`CoreMLScorer`) for later.
- The 10 rules hold 0 of 6,382 legit texts across train, val and test. Legit "Toll Free" texts in test held by v2: 0 of 3.
- Weak spot: investment scams that open with "sorry, wrong number" (13% probe recall). The payment hold catches the money step instead.
- Speeds are on an Apple M5 Pro Mac. We have no saved iPhone timing; the 2.6 MB extension memory was measured on one iPhone ([DECISIONS 27](ml/data/DECISIONS.md)).

Sources: [`ml/models/ngram_eval.json`](ml/models/ngram_eval.json), [`ml/models/guard/eval.json`](ml/models/guard/eval.json), [`ml/models/coreml_eval.json`](ml/models/coreml_eval.json), [`ml/models/guard_eval_swift_test.txt`](ml/models/guard_eval_swift_test.txt) and [`ml/models/guard_eval_swift_probe.txt`](ml/models/guard_eval_swift_probe.txt) (output of `swift run -c release guard-eval <csv> GuardInt8.mlpackage` in `ios/GuardKit`), and [`ml/data/DECISIONS.md`](ml/data/DECISIONS.md). The v1 row is from `ml/models/guard/eval.json` at commit `07ecb35`.

### Investment scams (Oct 17)

Pig-butchering scams start as a friendly "wrong number" text, build trust, then pitch a trading app and finally ask for a "fee" to withdraw fake profit. The test set's 6 "investment" rows are mostly fake Binance login-code texts, not this scam, so we score it on two synthetic sets, split by stage:

- `probe.csv` (85 rows): written by us, alongside the rules. Optimistic.
- `blind_probe.csv` (60 rows): written by a separate AI agent that never saw this repo, the rules or the training data, from FinCEN, CFTC and FBI scam descriptions. No near-duplicates of training rows. **This is the fair number.**

| Message Filter (10 rules + tiny model) | Opener caught | Pitch + fee caught | Legit wrongly held |
|---|---|---|---|
| `probe.csv` | 0% (10) | 26.7% (30) | 6.7% (30) |
| **`blind_probe.csv`** | **0% (10)** | **26.7% (30)** | **15.0% (20)** |

- **The text filter is not the defense for this scam.** Most pitch texts are about love, trust and pressure ("did you put the 5000 in?"), not keywords, so one text at a time rarely gives them away. The payment hold (crypto, new payee, unusual amount) is the catch at the money step.
- We tried two pitch rules (`trading_pitch`, `high_returns`). They caught 90% of our own probe but 1 of 30 blind texts, and held a text warning Mom about scams, so they were removed ([DECISIONS 30](ml/data/DECISIONS.md)). `withdraw_fee` stays (no legit holds anywhere).
- Blind-set false holds: the model holds real Chase and Kraken withdrawal alerts, and `safe_account` holds an FTC warning tip.
- Score any CSV the way the phone does, on any machine: `python -I ml/guard_check.py <csv> --rows`. It checks its regexes against `ScamRules.swift` first. Real texts from your own phone go in `ml/data/real_local.csv` (gitignored).
- Do not tune rules or training data on `blind_probe.csv`; it stops being blind. Use a new blind set to measure a change.
- Disclosure: the two pitch rules were dropped after seeing their blind result, so the blind number for the rules is slightly optimistic. The model was never tuned on it.
- The tiny model is not retrained. `synthetic.csv` has 17 investment pitch templates (40 rows) and 30 investment-themed legit rows waiting for `build.py` + `train_ngram.py`.

## Tiger Data performance

<!-- PERF:START -->
Measured 2026-10-17 on Tiger Cloud (TimescaleDB 2.30.2, PostgreSQL 18.6) with 1,000,000 synthetic rows in `spending` (200 circles, 40 payees each, 3 years).
Method: server time (planning + execution) from `explain (analyze, timing off)`, median of 21 warm runs after 3 warm-ups; continuous aggregates fully materialized first.

| Query | Raw, row store (ms) | Raw, columnstore (ms) | Continuous aggregate (ms) | Aggregate vs row store |
| --- | ---: | ---: | ---: | ---: |
| Dashboard weekly chart (1 circle, 13 weeks) | 2.61 | 2.75 | 1.10 | 2.4x faster |
| Unusual-spending baseline (1 circle, 1 category, 90 days) | 2.57 | 3.00 | 1.18 | 2.2x faster |
| "Her usual" at one payee (1 circle, 1 year) | 7.92 | 8.55 | 2.65 | 3.0x faster |
| Weekly totals, all 200 circles, 3 years | 2077.43 | 1517.67 | 150.23 | 13.8x faster |

Compression (columnstore, segment by circle): 163.3 MiB to 50.3 MiB, **3.2x smaller** (158 of 158 chunks).

Aggregate times are a best case: everything was materialized, while in production the current week is computed live from raw rows. The queries are simplified versions of the dashboard and rules queries.

Data source: `web/lib/perf-benchmark.json`. Recorded run previously published in docs/perf.md; values transcribed without rerunning the live benchmark.
Reproduce measurements: `npm run bench:perf` in `web/`, against a migrated throwaway `wt_*` schema only. Re-render these recorded results without a database: `npm run perf:report`.

<!-- PERF:END -->

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

Optional flags in `.env.example`: `APPROVAL_MODE` (`app` or `ciba`), `AUTH0_CIBA_RAR`, `AUTH0_RBAC`, `DEMO_BANK_LOCATIONS`. Demo helpers: `npm run demo:reset` (throwaway `wt_*` schema only, or `-- --live` for the real demo circle), `npm run demo:atm`, `npm run smoke:demo`, `npm run agent:bills` (needs `AUTH0_AGENT_CLIENT_ID` and `AUTH0_AGENT_CLIENT_SECRET`).

Checks: `npm run typecheck && npm run build && npm test`. Database tests: `npm run test:db`. More detail: [`web/INTEGRATION.md`](web/INTEGRATION.md).

### iPhone (`ios/`)

1. Open `ios/CheckWithUs/CheckWithUs.xcodeproj` in Xcode.
2. Set your signing team on the app and its three extensions (Message Filter, Call Directory, SafeCard).
3. Optional: put the demo caller's number in `CheckWithUs/scam-numbers.local.json` (gitignored).
4. Run on a real iPhone. The app shows as "Check With Us" in Settings. Turn on the filter in Settings, Apps, Messages, Unknown and Spam. Turn on the call labels in Settings, Apps, Phone, Call Blocking and Identification.
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

Submission materials: [Devpost draft](docs/devpost.md), [DEV article](docs/dev-post.md),
[expo pitch](docs/pitch.md), [demo runbook](docs/demo.md), [two-minute video script](docs/video-script.md),
and [publishing handoff](docs/publishing.md).

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
| Claude Code (Opus 5, Opus 5.5) | Most code in `web/`, `ios/` and `ml/`: backend, Nessie and Auth0 integration, Tiger Data schema and benchmark, family-circle logic, dataset pipeline, training and eval scripts, Core ML export, GuardKit, iPhone app and extensions, landing page, and these docs. Haiku subagents searched for datasets. TODO(Dev): confirm a human checked every dataset license by hand before keeping this claim. |
| OpenAI Codex CLI | Continued the `web/` backend: approval and reconciliation fixes, the synthetic demo seed, and the family dashboard. |
| OpenAI Codex CLI (read-only review) | Second-opinion review of changed files through a `Stop` hook, and review panels on the `ml/` dataset and the iPhone app. It found near-duplicate data leaks, label conflicts and several race conditions, which were then fixed. It reviews; a human and the authoring agent decide. |
| Apple Foundation Models (inside the product) | Runs on the phone and rewrites true facts into a short note for the family. It never decides anything. |
| Codex | Dashboard accessibility, scam-sequence evidence, benchmark report generation, local PostgreSQL tests, original SVG design handoff, and synthetic gallery/video captures. |

All code in this repository was written during the event window. The scam models
are trained by us; the project is not a reskin of an existing AI tool.

## Credits

Every third-party framework, library, API, model, dataset and font we use, with its
license. Required by Devpost rule 10 and [`docs/RULES.md`](docs/RULES.md).

### Services and APIs

| Service | Used for | Terms |
| --- | --- | --- |
| [Capital One Nessie](http://api.nessieisreal.com/) | Mock customers, accounts, merchants, purchases, bills, withdrawals, deposits, transfers, ATMs, branches | Capital One hackathon sandbox; mock data only |
| [Auth0](https://auth0.com/) | Family login, API tokens, roles, optional RBAC; CIBA Guardian push implemented, off by default | Auth0 free plan, developer terms |
| [Tiger Data / Tiger Cloud](https://www.tigerdata.com/) | Spending hypertable, compression, continuous aggregates | Tiger Cloud trial; TimescaleDB |
| [Vercel](https://vercel.com/) | Hosting for `web/` | Vercel Hobby terms |
| [GoDaddy Registry](https://registry.godaddy/) | `checkwith.us` domain (.us registry) | TODO(Dev): confirm the MLH code was used (whois registrar: Porkbun) |

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
| [@electric-sql/pglite](https://github.com/electric-sql/pglite) | 0.5.10 | Apache-2.0 |
| [@playwright/test](https://github.com/microsoft/playwright) | 1.64.1 | Apache-2.0 |
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
