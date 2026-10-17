# Expo pitch: 30 s judge video + 2:00 live talk (draft for Hitesh)

- **Owner:** Hitesh. This is a starting draft. Improve it with your agents, then rehearse it.
- **Goal:** win the sponsor challenges (Nessie, Auth0, Tiger Data, Easy On The Eyes, GoDaddy). Overall and Best Use of AI/ML are side entries. Do not build the pitch around them.
- **The trap:** if judges hear "scam protection for elderly people", we sound like every other team. Lead with how deep each sponsor's tech goes and what it does in the product.
- **Shape:** a 30 s judge video with only the wow moments, then a 2:00 live talk with one block per sponsor (tech, benefit, proof on the table). That is 2:30, with 30 s of buffer inside the 3:00 limit, then 1 minute of questions. The Devpost video (1:30 to 2:00) is a separate deliverable: [video-script.md](video-script.md).
- **Before the expo:** check every claim against the code and the live build. Cut anything that is not verified (see "Unverified").

Related: [demo.md](demo.md) (device setup, how to film the judge video, live "show me" steps, fallbacks), [PLAN.md](PLAN.md) (what we build and why), [RULES.md](RULES.md) (judging criteria), [perf.md](perf.md) (Tiger Data numbers).

## Hard requirements

1. The video is 30 s or less. It has captions and no voiceover, because the expo is loud.
2. The talk is 2:00 or less. With the video, the total is 2:30. The 1 minute of judge questions comes after.
3. Every sponsor block names the real features we use. "We used Auth0 for login" loses. Name the endpoints, the features and the numbers.
4. Every claim has a proof that a judge can see: a phone, the dashboard, a terminal, or a README table. Keep both phones live on the table.
5. Use synthetic Rosa only. Show no real names, numbers, tokens or pairing codes.

**Judges rotate (science-fair style).** When a sponsor judge walks up, start with their block and stretch it to about 60 s. Cut the other blocks to one line each. Know your audience before you speak: ask "Which sponsor are you judging?"

## Flow (2:30 of the 3:00 limit)

| Time | Part | Who (suggested) |
| --- | --- | --- |
| 0:00–0:30 | Judge video plays | Hitesh starts it |
| 0:30–0:45 | Opener: how we differ (15 s) | Dev |
| 0:45–2:05 | Sponsor blocks, 20 s each: Nessie, Auth0, Tiger Data, Easy On The Eyes | Haadi (Nessie, Auth0), rgons (Tiger Data, design) |
| 2:05–2:15 | AI/ML line (10 s) | Dev |
| 2:15–2:25 | GoDaddy + close (10 s) | Dev |
| 2:25–3:00 | Buffer | |

When a judge asks "show me", use the matching live step in [demo.md](demo.md).

## Part 1: the 30-second video

| Time | Shot | Caption | Sponsor shown |
| --- | --- | --- | --- |
| 0:00–0:04 | Rosa's iPhone: the scam toll text lands in Spam, not the inbox | "Scam text. Caught on her phone." | on-device model |
| 0:04–0:08 | Incoming call shows "Possible scam". She answers. | "She answers anyway. Scammers are persuasive." | |
| 0:08–0:16 | She pays $200 at a gift card store. Her screen: "Paused, waiting for family". Family phone shows the reasons. Tap Deny. Her lock screen: "Stopped". | "Her family decides, not the scammer." | Auth0, Easy On The Eyes |
| 0:16–0:22 | ATM cash $200, then a gift card. The hold reads "Cash at an ATM, then a gift card". | "Normal alone. A scam together." | Nessie, Tiger Data |
| 0:22–0:27 | Family taps Freeze. "Money is in the safe account." | "One tap. Her balance goes to a vault." | Nessie |
| 0:27–0:30 | checkwith.us logo | "She does nothing. Her family does the work." | GoDaddy |

Shoot it on the real phones with the pinned `main` build. How to film each shot: [demo.md](demo.md).

## Part 2: the talk

Each block has three parts: **Tech** (what we use), **Benefit** (why it matters to Rosa and her family), and **Proof** (what to point at).

### Opener (15 s): how we differ
> "Every scam tool asks the victim to act, and scammers talk victims right past warnings. The bank can't stop it, because she makes the payment herself. Monitoring apps alert the family after the money is gone. We move the decision. Rosa changes nothing. A payment that looks like a scam waits for her family before it reaches the bank. And one rule: AI suggests, code decides money."

### Capital One Nessie (20 s, 60 s if the Nessie judge is here)
**Tech.** Nessie is our bank, not just a data source. Our client calls 10 resource types, and each one has a job:

| Nessie resource | Its job in checkwith.us |
| --- | --- |
| Customers + accounts | Rosa has a spending account and a vault account |
| Merchants | Each payee becomes a Nessie merchant tagged with its category (gift card store, utility); the category drives the rules |
| Purchases | Approved store payments are real Nessie purchases |
| Bills | Known billers (City Power & Light) that allowances cover; approved bills are paid as Nessie bills |
| Withdrawals | ATM cash: the first half of the "cash, then gift card" scam |
| ATMs + branches | A geofence: the family gets an alert when she is at a bank during a phone call. Nessie's banks are near Washington, DC, so the demo adds one bank at our table (`DEMO_BANK_LOCATIONS`) |
| Transfers | Freeze (spending to vault). A family top-up also uses transfers, but it is API only, with no button yet: do not demo it |
| Deposits | Rosa's monthly pension in the seeded history; deposits count toward her spending balance |

> "Nessie is our bank. Ten resource types, and each one has a job. Every payee is a Nessie merchant with a category. Purchases and bills are the payments. Withdrawals catch ATM cash. ATMs and branches tell us she is at a bank during a call. Transfers power Freeze. Freeze runs exactly once, even if the family taps twice."

**Benefit:** the family protects real money flows, not a mock-up.
**Proof:** tap Freeze on the family phone. In the terminal, `npm run demo:atm` prints a real sandbox withdrawal.

### Auth0 (20 s, 60 s if the MLH judge is here)
**Tech.**
- iOS native login with PKCE. The server checks the signed Auth0 token on every family request.
- Family roles: approvers and viewers. Only an approver can approve. When Auth0 RBAC is on for our API, the token must also carry the `approve:payments` permission (see "Unverified").
- Over $1,000 (the default; the family can change it), two approvers must say yes, and one no stops it.
- Approve asks for Face ID (or the passcode) on the phone first. Step-up: Freeze, unfreeze, allowances and policy changes need an Auth0 sign-in from the last 5 minutes, and the app asks for one when it is older.
- **Auth0 for AI Agents:** a bill-pay agent signs in as its own Machine-to-Machine client with one scope, `pay:bills`. It can only ask to pay. Inside an allowance the family set, which expires ("utilities up to $400 until Nov 30"), the bill pays; outside one it is held for the family like any payment. Every family route rejects machine tokens.
- CIBA (Guardian push with the payment details): built and tested against a fake Auth0, not live. See "Unverified".

> "Auth0 is the family's authority, not just a login. Approvers and viewers are separate roles. Over $1,000 two approvers must agree, and one no wins. Approve needs Face ID, and Freeze or a new allowance needs a fresh Auth0 sign-in. And for AI agents: our bill-pay agent has its own Auth0 identity with exactly one scope. It can never approve anything. Without the family's limited, expiring allowance, its bills wait for the family."

**Benefit:** the person who says yes is provably the right family member, and an AI agent can never act like one.
**Proof:** approve a held payment with Face ID. Show the Allowances tab.

### Tiger Data (20 s, 60 s if the MLH judge is here)
**Tech.**
- The spending ledger is a hypertable with columnstore compression.
- Three real-time continuous aggregates. The daily one answers "is this more than 3 times her usual?" inside the payment request. The weekly and per-payee ones drive the dashboard chart and "About 4x her usual".
- The scam sequence is a time-window query: ATM cash, then a gift card, within two hours.
- Measured on 1,000,000 rows: weekly totals for all families are 13.8 times faster, and the data is 3.2 times smaller ([perf.md](perf.md)).

> "Her spending lives in a Tiger Data hypertable with compression and real-time continuous aggregates: daily, weekly and per payee. The daily one answers 'is this more than 3 times her usual?' in about a millisecond, while the payment waits. The scam pattern is a time-window query: ATM cash, then a gift card, within two hours. We measured it on a million rows: 13.8 times faster, 3.2 times smaller."

**Benefit:** the rules know her history right away, so the hold happens before money moves.
**Proof:** the live speed card on the dashboard, and the table in [perf.md](perf.md).

### Easy On The Eyes (20 s, 60 s if the SwampHacks judge is here)
**Tech.** Two users with two different designs.
- Older adult: the best interface is no new interface. Protection runs inside iOS (Message Filter, call labels, lock-screen card). When she sees the app: one action per screen, plain words, the largest text sizes, VoiceOver, text colors with at least 4.5:1 contrast, Reduce Motion, 56 pt tap targets.
- Family: every hold reason in plain words, "About 4x her usual", a spending chart.

> "The best interface for a scared 80-year-old is no new interface. Our protection runs inside iOS itself. When she does see our app, each screen has one action and plain words: 'Paused, waiting for family. Your money is safe. Your family will call you.' The family sees the reason in plain words too, never a risk score."

**Benefit:** nothing new to learn for the person under pressure.
**Proof:** Rosa's phone at the largest text size. The gallery and [design-principles.md](design-principles.md).

### Best Use of AI/ML (10 s, side entry; go deep only if asked)
> "We trained our own scam model. It runs inside the iOS Message Filter in 1 MB, so her texts never leave the phone. It can add a hold reason, never remove one."

Have ready if asked: our DistilBERT model is 67 MB, and iOS kills the Message Filter above about 25 to 30 MB, so we shipped a 1 MB n-gram model. It catches 96.0% of real scam texts with 2.4% false holds. We found a train/test leak and fixed it by clustering scam campaigns. Apple's on-device model writes the family note from facts our code picks.

### GoDaddy + close (10 s)
> "The name is the promise: before money moves, check with us. checkwith.us."

## Unverified: cut or verify before the expo

1. **Bill-pay agent:** the code is on main (PR #46 itself was closed unmerged), but the real Auth0 Machine-to-Machine grant is not tested on the live tenant. Ask Dev for one live `npm run agent:bills` run. If it does not run, say "tested against a fake Auth0".
2. **CIBA Guardian push:** built and tested against a fake Auth0 (`web/test/fake-auth0.ts`), not verified live. Do not say "live". Mention it only if a judge asks.
3. **GoDaddy:** the .us registry (RDAP, Oct 17) lists Porkbun as the registrar. Confirm with Dev that the MLH GoDaddy Registry code was used before claiming the prize.
4. **`approve:payments`:** the server checks this Auth0 permission only when the token carries a `permissions` claim or `AUTH0_RBAC=true`. Otherwise the circle's approver role alone decides. Before saying "Auth0 RBAC", confirm RBAC is on for the live Auth0 API.
5. **Freeze on stage:** Freeze needs an Auth0 sign-in from the last 5 minutes. If iPhone B signed in earlier, tapping Freeze opens the Auth0 login sheet first. Sign in again on iPhone B just before a judge arrives.

Checked against `main` on Oct 17 (Hitesh, with Claude Code): the 10 Nessie resource types, Freeze exactly once, `demo:atm`, PKCE, token checks, roles, the 2-approver rule, the agent's scope and machine-token rejection, the hypertable, compression, the three continuous aggregates, the 2-hour window, the [perf.md](perf.md) numbers, the speed card, the screen wording, the accessibility list and the model numbers in the README.

## Next steps for Hitesh

1. ~~Have your agents check every claim here against the code.~~ Done Oct 17; see the list above.
2. Make each sponsor block deeper and sharper. Stay at 20 s each in the default order.
3. Write the 60 s version of each block, for when that sponsor's judge is at the table.
4. Film the 30 s judge video on the real phones ([demo.md](demo.md)). Then record the Devpost video ([video-script.md](video-script.md)).
5. Run the video plus the 2:00 talk with a timer, twice, with the whole team.
