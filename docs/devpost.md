# Devpost draft: checkwith.us

Copy each section into the matching Devpost field. Check every `TODO(Dev):` before submitting. Due **Sun Oct 18, 7:30 AM EDT**.

Recording plan: [two-minute video script](video-script.md). Upload captions and account steps: [publishing handoff](publishing.md).

Everything here is on `main` and live at checkwith.us.

- **Project name:** checkwith.us
- **Elevator pitch (max 200 characters):** Before money moves, check with us. Scam texts filtered on the phone, scam calls labeled, risky payments paused until the family says yes.
- **Links:** https://checkwith.us and https://github.com/builtbyd3v/checkwithus
- **Video (max 2 minutes):** [38-second synthetic dashboard backup clip](gallery/dashboard-backup.webm), with [captions](gallery/dashboard-backup.srt). This is UI-only backup footage; upload the complete team/device demo and add its public link before submission.
- **Opt in to all 7 (exact names):** Best First Timers; Capital One - The Best Use of Nessie!; MLH Prize: Best Domain Name from GoDaddy Registry; MLH Prize: Best Use of Auth0; MLH Prize: Best Use of Tiger Data; Easy On the Eyes Award - Best UI/UX Design; MLH - DEV Writing Challenge.
- **Specialized track:** Best First Timers only (at most one is allowed). Two of our four teammates are at their first hackathon; eligibility confirmed with organizers on Oct 18.

---

## Inspiration

Most scam protection asks the person at risk to do something: install a tool, read a warning, make a decision under pressure. Scammers are good at pressure. We wanted a design where the older adult changes nothing about how they use their phone, and the people who already worry about them, their family, carry the work.

## What it does

checkwith.us is one iPhone app with two roles, plus a web dashboard.

**For the older adult, nothing new to do:**
- **Scam texts never reach the inbox.** Our own scam model runs inside an iOS Message Filter extension, on the phone. Scam texts go to Spam.
- **Scam calls ring as "Possible scam."** A Call Directory extension labels known scam numbers.
- **Risky payments pause.** The app has one big "Pay a bill" flow. Our server checks every payment against fixed rules: gift cards, crypto, wire transfers, new payees, amounts over the family's limit, spending far above their usual, payments made during a phone call, and ATM cash followed by a gift card. A held payment shows "Paused, waiting for family" on the phone and on a lock-screen card, which updates while the app checks the server.
- **"Ask my family."** One big button sends the family an alert.
- **Bank while on a call.** If the phone is at a bank or ATM during a phone call, the family gets an alert. Only the bank's name is sent, never their location.
- **Built for older eyes.** Tested at the largest accessibility text size, with VoiceOver announcements, high-contrast colors, 56 pt tap targets and Reduce Motion support.

**For the family:**
- **Approve or deny** each held payment on the family iPhone app or the web dashboard. On the phone, Approve asks for Face ID first; the server checks the approver's signed Auth0 token. Each reason is in plain words, with a short note written on the older adult's phone by Apple's on-device model. A phone with no passcode cannot approve.
- **Family circle:** approvers and viewers. By default, over $1,000 two approvers must say yes; one no stops it. Families can change the amount or turn it off on the dashboard.
- **Hold limit:** payments over $300 hold by default. Families can change the amount or turn it off on the dashboard. The scam rules always apply.
- **Freeze:** one tap moves the whole spending balance to a vault account. No fresh sign-in, because it only protects money.
- **Top up:** an approver adds money from their own account (API built; no phone screen yet).
- **Alerts and context:** "Ask my family" and bank alerts in a list, and "About Nx their usual" (from their history at that payee) next to a held payment.
- **Allowances:** a scoped, expiring "yes in advance", for example utilities up to $400 until Nov 30. It lifts only the amount limits for a known payee, never a scam hold.
- **Bill-pay agent:** an agent with its own Auth0 identity proposes routine bills. Built, merged and verified live on Oct 17. Inside the allowance they pay. Outside it the normal rules decide: a known biller under the hold limit pays, and a bill over the limit is held for the family.

**Three hard rules:** AI suggests, code decides money. Money is integer cents everywhere. The older adult's texts and bills never go to a cloud AI model.

## How we built it

- **iPhone (Swift, SwiftUI):** the app, a Message Filter extension (IdentityLookup), a Call Directory extension (CallKit), a Live Activity (ActivityKit), a bank geofence watcher (Core Location `CLMonitor`), Auth0 native login with PKCE, and Face ID (LocalAuthentication). Scam scoring lives in GuardKit, our own Swift package: a WordPiece tokenizer, 10 action-based rules, an n-gram scorer and a Core ML scorer.
- **On-device AI:** two models trained by us on openly licensed SMS datasets. The app ships only Guard tiny (`NGramScorer`), a 1 MB character and word n-gram logistic regression that runs in the Message Filter and the app. Guard v2 fine-tunes DistilBERT; it is trained and evaluated but not shipped, because at 67 MB it does not fit in the Message Filter. Apple Foundation Models rewrites the true facts about a held payment into a calm note for the family; code picks the facts and checks the note kept the risk facts.
- **Backend (Next.js App Router, TypeScript, Vercel):** a payment API with idempotency keys, a pure `decideHold` rule function, the family API and dashboard, and a landing page whose "Try a payment" widget runs the same `decideHold` code.
- **Data:** Tiger Data (TimescaleDB on Tiger Cloud) holds the spending ledger as a hypertable with compression and real-time continuous aggregates.
- **Money:** Capital One Nessie is the bank. Every allowed payment becomes a Nessie purchase, bill or withdrawal.
- **Identity:** Auth0 for logins, API tokens, roles, an optional `approve:payments` permission, and fresh-login checks. A CIBA Guardian push is built and tested, and off in the demo.

## Challenges we ran into

- **The Message Filter has a tight memory limit.** Our 67 MB Core ML DistilBERT killed the extension on a real iPhone. A probe build died about 21 MB above baseline on iOS 26. We trained a 1 MB n-gram model instead. It uses 2.6 MB in the extension and catches 96.0% of real scam texts in our test set.
- **Our first dataset split leaked.** A read-only Codex review found near-duplicate scam campaigns in both train and test, and a validation set that was 91% generated text. We clustered texts by character 5-gram similarity, kept whole clusters in one split, and made val and test real texts only.
- **Nessie surprises.** Purchases must be whole dollars. The reported account balance does not change after payments. So Tiger Data keeps the payment ledger, and each payment is still a real Nessie purchase or bill.
- **Exactly once.** A payment must never be sent twice, even when a phone retries, an app restarts mid-request, or two family members tap at once. Idempotency keys, row locks and several rounds of review fixed real race conditions.
- **The on-device model invents things.** Asked to explain a hold on its own, Apple's model wrote "the caller asked for gift cards" when there was no call. Now code picks only true facts, the model only rewords them, and the note is dropped if it loses a risk fact.
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
- Our two first-timers: Hitesh wrote the pitch script and planned the demo video. Rishon did the design research that Dev turned into the app and dashboard design.

## What's next for checkwith.us

- A real scam-number feed for the Call Directory (for example FTC complaint data), instead of a demo list.
- Push notifications for alerts (today the family app polls every 10 seconds).
- Use the per-payee aggregate in the hold rules too, not only on the dashboard.
- A top-up screen in the family app.
- Better coverage of "wrong number" investment scams (0 of 10 blind openers caught today).
- A usability test with older adults and their families.

## Built with

swift, swiftui, core-ml, foundation-models, callkit, identitylookup, activitykit, widgetkit, core-location, typescript, next.js, react, tailwindcss, node.js, postgresql, timescaledb, tiger-data, capital-one-nessie, auth0, vercel, godaddy-registry, remotion, elevenlabs, python, pytorch, hugging-face-transformers, distilbert, coremltools, pandas, zod, vitest

---

## Sponsor challenges

### Bill-pay agent (Auth0 for AI Agents)
The bill-pay agent has its own Auth0 identity: a Machine-to-Machine client whose token holds one scope, `pay:bills`.
- It can only ask. For each known biller it proposes the next bill with a fixed rule; no AI model sees the older adult's bills.
- The same rules decide, the same path as the older adult's phone. Inside the family's expiring allowance, the bill pays with no push. Outside it, the normal rules apply: a known biller under the hold limit pays, and a bill over the limit or far above usual is held and the family is asked once (family app, or Guardian push in CIBA mode).
- Least privilege: it acts only where the family granted a live allowance, never pays a cycle twice, and never asks again after a no. Every family route rejects machine tokens, so it can never approve, freeze or grant itself more. Revoking the allowance stops it.
- The dashboard labels its payments ("Paid by the bill agent under your Utilities allowance").
- Built and merged to `main`. Verified on the live Auth0 tenant on Oct 17: the agent signs in with only `pay:bills` and pays a due bill under the family allowance.

### Capital One: Best Use of Nessie
Nessie is the bank in every step. Each endpoint has a job:
- **Customers and accounts:** a spending account and a vault account for the older adult.
- **Merchants:** payees with categories, which drive the hold rules.
- **Purchases and bills:** every payment the rules or the family allow is sent to Nessie.
- **Withdrawals and ATMs:** ATM cash is a real Nessie withdrawal. The link to the Nessie ATM lives in our ledger (`spending.atm_id`). A gift card within 2 hours of that cash adds the scam-sequence reason. A gift card is always held; the sequence tells the family why it looks like a scam.
- **Withdrawals for people:** a payment to a person is sent as a Nessie withdrawal.
- **Transfers:** Freeze moves the whole spending balance to the vault, exactly once. Family top-up moves money from an approver's own account, counted only once Nessie confirms it.
- **Deposits:** the older adult's monthly pension is written as Nessie deposits and adds to their ledger balance.
- **ATMs and branches:** the phone watches the nearest ones and alerts the family if they are there during a phone call. Demo locations can be added for the expo.
- **Balance:** Nessie's sandbox never updates stored balances, so the available balance is our ledger minus reserved payments, with Nessie's reported balance shown for information.

### MLH: Best Use of Auth0
- Auth0 login on the family dashboard, and native PKCE login in the family iPhone app.
- Every family API route checks a signed Auth0 access token for our API audience.
- Roles on the server: approvers decide, viewers watch. By default, payments over $1,000 need two different approvers; families can change the amount or turn it off on the dashboard.
- Optional RBAC (`AUTH0_RBAC=true`): approving in the family app needs the `approve:payments` permission in the access token; a missing claim counts as no. Denying needs only the circle role, because it only stops money.
- Fresh login (no older than 5 minutes, from `auth_time`) before granting an allowance, changing roles, unfreezing or topping up. Freeze is one tap, because it only protects money.
- **Auth0 for AI Agents:** we implemented Client-Initiated Backchannel Authentication (CIBA). With `APPROVAL_MODE=ciba`, a held payment sends a Guardian push and waits for a human out of band. With `AUTH0_CIBA_RAR=true` as well, the push carries the amount, payee and hold reasons as rich `authorization_details`. Status: built and tested against a fake Auth0, and off in the demo (`APPROVAL_MODE=app`, where the family app approves). We did fix one bug only the real tenant showed (an `audience` it rejects).
- **Agent identity:** the bill-pay agent is its own Machine-to-Machine client with only `pay:bills` (client credentials). Its route checks the grant type, its own `sub` and the scope; every family route rejects machine tokens. See "Bill-pay agent" above.

### MLH: Best Use of Tiger Data
- `spending` is a hypertable (7-day chunks) with columnstore compression, segmented by family circle.
- Real-time continuous aggregates: `spending_daily` feeds the "much more than usual" hold rule. `spending_weekly`, built on top of it (hierarchical), feeds the dashboard's weekly chart. `spending_payee_daily` feeds the dashboard's "About Nx their usual at this payee" line.
- The dashboard's speed card times the real weekly chart query on the aggregate and on raw rows, live, and shows the compression ratio of the whole table.
- A time-window query on the hypertable catches "ATM cash, then a gift card within 2 hours".
- Recorded October 17 measurements on 1,000,000 rows (200 circles, 3 years) on Tiger Cloud. The per-family queries the product runs are 2.2x to 3x faster on the aggregates: the dashboard weekly chart drops from 2.61 ms to 1.10 ms (2.4x), the unusual-spending baseline from 2.57 ms to 1.18 ms (2.2x), and the per-payee usual from 7.92 ms to 2.65 ms (3.0x). The all-families rollup (weekly totals for 200 circles over 3 years) drops from 2077.43 ms to 150.23 ms (13.8x). Compression: 163.3 MiB to 50.3 MiB (3.2x smaller). Aggregate times are a best case (fully materialized). Full method in the README.

### Easy On The Eyes (Best UI/UX)
- Older adult screens: large Dynamic Type text, big tap targets, plain words, one action per screen. Home says "You're safe". A held payment says "Your money is safe. Your family will call you."
- The family sees every hold reason in plain words, never "the AI said so".
- Stopping money is one tap; approving asks for Face ID first.
- Accessibility pass at the largest text size: pinned buttons on an opaque bar, no mid-word breaks, VoiceOver announces the real outcome, darker colors for contrast, 56 pt tap targets, Reduce Motion.
- Six design principles, each tied to a cited finding and a real screen: `docs/design-principles.md` and `docs/research.md`.
- Gallery upload candidates: actual app captures `03-older-adult-home-safe`, `05-family-approvals`, `06-family-why-we-paused`, plus `dashboard-sequence-390`. New design boards `design-sketch`, `design-wireframe`, `design-final` are explicitly post-implementation explorations, not earlier process evidence. See `docs/design/handoff.md` and `docs/gallery/dashboard-review.md`. Upload selected assets with a sentence on the design choice.

### MLH: Best Domain Name from GoDaddy Registry
checkwith.us is the product name, the brand and the live site. Read the address as a sentence: "check with .us". The name is the promise: before money moves, it checks with us, the family. We registered it with the MLH GoDaddy Registry code. MLH codes are redeemed through Porkbun, and the .us registry is GoDaddy Registry.

### MLH: DEV Writing Challenge
TODO(Dev): add the DEV post link (draft in `docs/dev-post.md`).

### Best First Timers (our specialized track)
Two of the four of us, Hitesh and Rishon, are at our first hackathon. Hitesh wrote the pitch script and planned the demo video. Rishon did the design research that Dev turned into the app and dashboard design.

### Our scam models (shown for judges, not an entry)
Two models we trained, with honest scores on 884 real test texts (README "Model evaluation"):
- Guard tiny (n-gram logistic regression, 1 MB, shipped in the Message Filter and the app): 97.2% accuracy, 96.0% scam recall, 2.4% false holds, 0.14 ms per text on a Mac.
- Guard v2 (DistilBERT, trained and evaluated, not shipped): 97.4% accuracy, 94.0% scam recall, 1.3% false holds. Core ML 8-bit: 67 MB, 94.0% recall, 1.1% false holds.
- Caveat we disclose: the 97% validation recall target was picked after seeing one test result, so these test numbers are slightly optimistic. Investment scams are a weak spot: on a blind synthetic set, 0 of 10 "wrong number" openers and 26.7% of 30 pitch texts are caught.
- The model never moves money: it can only add a hold reason.

---

## AI tools disclosure

We used AI coding tools, as allowed by the SwampHacks and MLH rules:
- **Claude Code (Anthropic, Opus 5 and Opus 5.5):** wrote most of the code in `web/`, `ios/` and `ml/`, and drafted these docs, with Haiku subagents for dataset search. Licenses listed in `ml/data/SOURCES.md`.
- **OpenAI Codex CLI:** continued parts of the web backend (approval and reconciliation fixes, the demo seed, the dashboard).
- **Codex:** dashboard accessibility, scam-sequence evidence, benchmark reporting, local PostgreSQL tests, original SVG design assets, synthetic UI video, and submission-material editing.
- **OpenAI Codex CLI (review):** read-only second-opinion code review on changed files and review panels on the dataset and app. It found real bugs, which we verified and fixed.
- **ElevenLabs:** voice, music and sound effects for the demo video.
- **Remotion:** video rendering for the demo video.
- **Inside the product:** Apple Foundation Models runs on the phone to rewrite facts into a note for the family. Our scam models are trained by us. checkwith.us is not a reskin of an existing AI tool.

All code was written during the event. Each pull request names the AI tools it used.
