# Devpost draft: checkwith.us

Copy each section into the matching Devpost field. Check every `TODO(Dev):` before submitting. Due **Sun Oct 18, 8:00 AM ET**.

Recording plan: [two-minute video script](video-script.md). Upload captions and account steps: [publishing handoff](publishing.md).

Build scope: this draft describes the development branch rishon (draft PR #54), not the currently deployed main branch. Before publishing, verify the same reviewed build on devices and the server, and remove any feature that is not demonstrated. Auth0 Guardian and the bill agent are implemented but remain unverified on the live tenant here.

- **Project name:** checkwith.us
- **Elevator pitch (max 200 characters):** Scam protection where the older adult does nothing and the family does the work. Scam texts filtered on the phone, scam calls labeled, risky payments paused for family approval.
- **Links:** https://checkwith.us and https://github.com/builtbyd3v/checkwithus
- **Video (max 2 minutes):** [38-second synthetic dashboard backup clip](gallery/dashboard-backup.webm), with [captions](gallery/dashboard-backup.srt). This is UI-only backup footage; upload the complete team/device demo and add its public link before submission.
- **Opt in to all 7 (exact names):** Best Use of AI/ML; Capital One - The Best Use of Nessie!; MLH Prize: Best Domain Name from GoDaddy Registry; MLH Prize: Best Use of Auth0; MLH Prize: Best Use of Tiger Data; Easy On the Eyes Award - Best UI/UX Design; MLH - DEV Writing Challenge.
- **Specialized track:** Best Use of AI/ML only (at most one is allowed).

---

## Inspiration

Most scam protection asks the person at risk to do something: install a tool, read a warning, make a decision under pressure. Scammers are good at pressure. We wanted a design where the older adult changes nothing about how they use their phone, and the people who already worry about them, their family, carry the work.

TODO(Dev): add a true personal reason if the team has one. Do not invent a story.

## What it does

checkwith.us is one iPhone app with two roles, plus a web dashboard.

**For the older adult, nothing new to do:**
- **Scam texts never reach the inbox.** Our own scam model runs inside an iOS Message Filter extension, on the phone. Scam texts go to Spam.
- **Scam calls ring as "Possible scam."** A Call Directory extension labels known scam numbers.
- **Risky payments pause.** The app has one big "Pay a bill" flow. Our server checks every payment against fixed rules: gift cards, crypto, wire transfers, new payees, amounts over the family's limit, spending far above her usual, payments made during a phone call, and ATM cash followed by a gift card. A held payment shows "Paused, waiting for family" on the phone and on a lock-screen card, which updates while the app checks the server.
- **"Ask my family."** One big button sends the family an alert.
- **Bank while on a call.** If the phone is at a bank or ATM during a phone call, the family gets an alert. Only the bank's name is sent, never her location.
- **Built for older eyes.** Tested at the largest accessibility text size, with VoiceOver announcements, high-contrast colors, 56 pt tap targets and Reduce Motion support.

**For the family:**
- **Approve or deny** each held payment on the family iPhone app or the web dashboard. On the phone, Approve asks for Face ID first; the server checks the approver's signed Auth0 token. Each reason is in plain words, with a short note written on the older adult's phone by Apple's on-device model. TODO(Dev): keep "a phone with no passcode cannot approve" out until that fix merges.
- **Family circle:** approvers and viewers. Over $1,000 (default), two approvers must say yes; one no stops it.
- **Freeze:** one tap moves the whole spending balance to a vault account.
- **Top up:** an approver adds money from their own account (API built; no phone screen yet).
- **Alerts and context:** "Ask my family" and bank alerts in a list, and "About Nx Rosa's usual" (from her history at that payee) next to a held payment.
- **Allowances:** a scoped, expiring "yes in advance", for example utilities up to $400 until Nov 30. It lifts only the amount limits for a known payee, never a scam hold.
- **Bill-pay agent:** an agent with its own Auth0 identity proposes routine bills. Inside the allowance they pay; outside, the family is asked.

**Three hard rules:** AI suggests, code decides money. Money is integer cents everywhere. The older adult's texts and bills never go to a cloud AI model.

## How we built it

- **iPhone (Swift, SwiftUI):** the app, a Message Filter extension (IdentityLookup), a Call Directory extension (CallKit), a Live Activity (ActivityKit), a bank geofence watcher (Core Location `CLMonitor`), Auth0 native login with PKCE, and Face ID (LocalAuthentication). Scam scoring lives in GuardKit, our own Swift package: a WordPiece tokenizer, 9 action-based rules, an n-gram scorer and a Core ML scorer.
- **On-device AI:** two models trained by us on openly licensed SMS datasets. The app ships only Guard tiny (`NGramScorer`), a 1 MB character and word n-gram logistic regression that runs in the Message Filter and the app. Guard v2 fine-tunes DistilBERT; it is trained and evaluated but not shipped, because at 67 MB it does not fit in the Message Filter. Apple Foundation Models rewrites the true facts about a held payment into a calm note for the family; code picks the facts and checks the note kept them.
- **Backend (Next.js App Router, TypeScript, Vercel):** a payment API with idempotency keys, a pure `decideHold` rule function, the family API and dashboard, and a landing page whose "Try a payment" widget runs the same `decideHold` code.
- **Data:** Tiger Data (TimescaleDB on Tiger Cloud) holds the spending ledger as a hypertable with compression and real-time continuous aggregates.
- **Money:** Capital One Nessie is the bank. Every allowed payment becomes a Nessie purchase or bill.
- **Identity:** Auth0 for logins, API tokens, roles, an optional `approve:payments` permission, and fresh-login checks. A CIBA Guardian push is implemented but off by default.

## Challenges we ran into

- **The Message Filter has a tight memory limit.** Our 67 MB Core ML DistilBERT killed the extension on a real iPhone. A probe build died about 21 MB above baseline on iOS 26. We trained a 1 MB n-gram model instead. It uses 2.6 MB in the extension and catches 96.0% of real scam texts in our test set.
- **Our first dataset split leaked.** A read-only Codex review found near-duplicate scam campaigns in both train and test, and a validation set that was 91% generated text. We clustered texts by character 5-gram similarity, kept whole clusters in one split, and made val and test real texts only.
- **Nessie surprises.** Purchases must be whole dollars. The reported account balance does not change after payments. So Tiger Data keeps the payment ledger, and each payment is still a real Nessie purchase or bill.
- **Exactly once.** A payment must never be sent twice, even when a phone retries, an app restarts mid-request, or two family members tap at once. Idempotency keys, row locks and several rounds of review fixed real race conditions.
- **The on-device model invents things.** Asked to explain a hold on its own, Apple's model wrote "the caller asked for gift cards" when there was no call. Now code picks only true facts, the model only rewords them, and the note is dropped if it loses a fact.
- **Nessie's banks are all near Washington, DC.** To demo the bank alert in Gainesville, the server can add demo bank locations from an environment variable (`DEMO_BANK_LOCATIONS`), and debug builds have a "make this spot a test bank" button.
- **A Guardian push bug only the real tenant showed.** Our CIBA request always sent `audience`, and the real Auth0 tenant rejected it, so every push would have failed. Tests against our fake Auth0 had passed. Now `audience` is sent only with payment details turned on.

## Accomplishments that we're proud of

- A scam model we trained runs inside the iOS Message Filter on a real iPhone, in 1 MB.
- The AI can only make the system more careful. In `decideHold`, a model score can add a hold reason and can never remove one.
- Honest evaluation: real-text test set, leak checks, and a disclosed caveat where we tuned the threshold after seeing a test result.
- A measured Tiger Data story on 1,000,000 rows, not a guess.

## What we learned

- Platform limits shape the model. The best model on paper did not fit where it had to run.
- Data hygiene matters. With a validation set that was 91% generated text, the tuned threshold gave 88.9% test recall. After we made validation real text only (and fixed the leaks), Guard v1 reached 98.4%.
- Give the language model facts to rewrite, not a job to decide.
- An independent read-only reviewer catches bugs the authoring agent misses.

## What's next for checkwith.us

- A real scam-number feed for the Call Directory (for example FTC complaint data), instead of a demo list.
- Push notifications for alerts (today the family app polls every 10 seconds).
- Use the per-payee aggregate in the hold rules too, not only on the dashboard.
- A top-up screen in the family app.
- Better coverage of "wrong number" investment scams (13% recall on our probe set).
- A usability test with older adults and their families.

## Built with

swift, swiftui, core-ml, foundation-models, callkit, identitylookup, activitykit, widgetkit, core-location, typescript, next.js, react, tailwindcss, node.js, postgresql, timescaledb, tiger-data, capital-one-nessie, auth0, vercel, godaddy-registry, python, pytorch, hugging-face-transformers, distilbert, coremltools, pandas, zod, vitest

---

## Sponsor challenges

### Bill-pay agent (Auth0 for AI Agents)
Rosa's bill-pay agent has its own Auth0 identity: a Machine-to-Machine client whose token holds one scope, `pay:bills`.
- It can only ask. For each known biller it proposes the next bill with a fixed rule; no AI model sees Rosa's bills.
- The same rules decide, the same path as Rosa's phone. Inside the family's expiring allowance, the bill pays with no push. Outside it, the payment is held and the family is asked once (family app, or Guardian push in CIBA mode).
- Least privilege: it acts only where the family granted a live allowance, never pays a cycle twice, and never asks again after a no. Every family route rejects machine tokens, so it can never approve, freeze or grant itself more. Revoking the allowance stops it.
- The dashboard labels its payments ("Paid by the bill agent under your Utilities allowance").
- TODO(Dev): the real M2M grant is not verified on the live tenant. Verify one `npm run agent:bills` run, or say "tested against a fake Auth0".

### Capital One: Best Use of Nessie
Nessie is the bank in every step. Each endpoint has a job:
- **Customers and accounts:** a spending account and a vault account for the older adult.
- **Merchants:** payees with categories, which drive the hold rules.
- **Purchases and bills:** every payment the rules or the family allow is sent to Nessie.
- **Withdrawals and ATMs:** ATM cash at a real Nessie ATM, followed by a gift card within 2 hours, is held as a scam sequence.
- **Transfers:** Freeze moves the whole spending balance to the vault, exactly once. Family top-up moves money from an approver's own account, counted only once Nessie confirms it.
- **Deposits:** Rosa's monthly pension is written as Nessie deposits and adds to her ledger balance.
- **ATMs and branches:** the phone watches the nearest ones and alerts the family if she is there during a phone call. Demo locations can be added for the expo.
- **Balance:** Nessie's sandbox never updates stored balances, so the available balance is our ledger minus reserved payments, with Nessie's reported balance shown for information.

### MLH: Best Use of Auth0
- Auth0 login on the family dashboard, and native PKCE login in the family iPhone app.
- Every family API route checks a signed Auth0 access token for our API audience.
- Roles on the server: approvers decide, viewers watch. Payments over the threshold need two different approvers.
- Optional RBAC (`AUTH0_RBAC=true`): approving needs the `approve:payments` permission in the access token; a missing claim counts as no. Denying needs only the circle role, because it only stops money.
- Fresh login (no older than 5 minutes, from `auth_time`) before granting an allowance, changing roles, unfreezing or topping up.
- **Auth0 for AI Agents:** we implemented Client-Initiated Backchannel Authentication (CIBA). With `APPROVAL_MODE=ciba`, a held payment sends a Guardian push and waits for a human out of band. With `AUTH0_CIBA_RAR=true` as well, the push carries the amount, payee and hold reasons as rich `authorization_details`. Honest status: both are off by default (`APPROVAL_MODE=app`, where the family app approves), tested against a fake Auth0 only, and a live Guardian push is not verified. We did fix one bug only the real tenant showed (an `audience` it rejects).
- **Agent identity:** the bill-pay agent is its own Machine-to-Machine client with only `pay:bills` (client credentials). Its route checks the grant type, its own `sub` and the scope; every family route rejects machine tokens. See "Bill-pay agent" above.

### MLH: Best Use of Tiger Data
- `spending` is a hypertable (7-day chunks) with columnstore compression, segmented by family circle.
- Real-time continuous aggregates: `spending_daily` feeds the "much more than usual" hold rule. `spending_weekly`, built on top of it (hierarchical), feeds the dashboard's weekly chart. `spending_payee_daily` feeds the dashboard's "About Nx Rosa's usual at this payee" line.
- The dashboard's speed card times the real weekly chart query on the aggregate and on raw rows, live, and shows the compression ratio of the whole table.
- A time-window query on the hypertable catches "ATM cash, then a gift card within 2 hours".
- Recorded October 17 measurements on 1,000,000 rows (200 circles, 3 years) on Tiger Cloud: weekly totals for all circles over 3 years drop from 2077.43 ms to 150.23 ms (13.8x faster). The dashboard weekly chart drops from 2.61 ms to 1.10 ms (2.4x). Compression: 163.3 MiB to 50.3 MiB (3.2x smaller). Aggregate times are a best case (fully materialized). These preserved results were not rerun for this draft. Full method in the README.

### Easy On The Eyes (Best UI/UX)
- Older adult screens: large Dynamic Type text, big tap targets, plain words, one action per screen. Home says "You're safe". A held payment says "Your money is safe. Your family will call you."
- The family sees every hold reason in plain words, never "the AI said so".
- Stopping money is one tap; approving asks for Face ID first.
- Accessibility pass at the largest text size: pinned buttons on an opaque bar, no mid-word breaks, VoiceOver announces the real outcome, darker colors for contrast, 56 pt tap targets, Reduce Motion.
- Six design principles, each tied to a cited finding and a real screen: `docs/design-principles.md` and `docs/research.md`.
- Gallery upload candidates: actual app captures `03-older-adult-home-safe`, `05-family-approvals`, `06-family-why-we-paused`, plus `dashboard-sequence-390`. New design boards `design-sketch`, `design-wireframe`, `design-final` are explicitly post-implementation explorations, not earlier process evidence. See `docs/design/handoff.md` and `docs/gallery/dashboard-review.md`. Upload selected assets with a sentence on the design choice.

### MLH: Best Domain Name from GoDaddy Registry
checkwith.us is the product name, the brand and the live site. The name is the promise: before money moves, it checks with us, the family. We registered it with the MLH GoDaddy Registry code. MLH codes are redeemed through Porkbun, and the .us registry is GoDaddy Registry.

### MLH: DEV Writing Challenge
TODO(Dev): add the DEV post link (draft in `docs/dev-post.md`).

### Best Use of AI/ML (our specialized track)
Two models we trained, with honest scores on 884 real test texts (README "Model evaluation"):
- Guard tiny (n-gram logistic regression, 1 MB, shipped in the Message Filter and the app): 97.2% accuracy, 96.0% scam recall, 2.4% false holds, 0.14 ms per text on a Mac.
- Guard v2 (DistilBERT, trained and evaluated, not shipped): 97.4% accuracy, 94.0% scam recall, 1.3% false holds. Core ML 8-bit: 67 MB, 94.0% recall, 1.1% false holds.
- Caveat we disclose: the 97% validation recall target was picked after seeing one test result, so these test numbers are slightly optimistic. Investment "wrong number" openers are a weak spot (13% recall on 15 synthetic probe texts).
- The model never moves money: it can only add a hold reason.

---

## AI tools disclosure

We used AI coding tools, as allowed by the SwampHacks and MLH rules:
- **Claude Code (Anthropic, Opus 5 and Opus 5.5):** wrote most of the code in `web/`, `ios/` and `ml/`, and drafted these docs, with Haiku subagents for dataset search. TODO(Dev): confirm a human checked every dataset license by hand, then keep or cut this sentence: "A human checked every dataset license by hand."
- **OpenAI Codex CLI:** continued parts of the web backend (approval and reconciliation fixes, the demo seed, the dashboard).
- **Codex:** dashboard accessibility, scam-sequence evidence, benchmark reporting, local PostgreSQL tests, original SVG design assets, synthetic UI video, and submission-material editing.
- **OpenAI Codex CLI (review):** read-only second-opinion code review on changed files and review panels on the dataset and app. It found real bugs, which we verified and fixed.
- **Inside the product:** Apple Foundation Models runs on the phone to rewrite facts into a note for the family. Our scam models are trained by us. checkwith.us is not a reskin of an existing AI tool.

All code was written during the event. Each pull request names the AI tools it used.
