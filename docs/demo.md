# checkwith.us expo demo (3 minutes)

Hard limit: 3 minutes, then 1 minute of judge questions ([RULES.md](RULES.md)).

## Cast and props

| Who | Device | Shows |
| --- | --- | --- |
| Rosa, the older adult | iPhone A: older adult role, debug build of `dev-integration` | Home, Pay a bill, held screen, lock-screen card |
| Her family | iPhone B: family app (family role), same `dev-integration` build, signed in with Auth0 | Approvals, Alerts, Money (Freeze) |
| Backup for the family | MacBook: checkwith.us/dashboard | Waiting payments, spending chart |
| The scammer | Google Voice (laptop or a third phone) | One scam text, one call |

Rosa is synthetic ("Rosa CheckWith (synthetic)"). Never use a real person's name or number.

## Pre-demo checklist (do 15 minutes before)

One build for everything
- [ ] Both iPhones and the web run the same local `dev-integration` branch (main plus PRs #30 to #34). Never mix single feature branches.
- [ ] Web: `dev-integration` is deployed to checkwith.us. `curl https://checkwith.us/api/health` prints `{"ok":true,"database":"reachable"}`.
- [ ] Migrations applied from `dev-integration`: `cd web && npm run db:migrate` (includes 014, 015 and 016).
- [ ] Seed is current: `npm run seed:demo` (safe to rerun).
- [ ] Do NOT run `npm run demo:atm` in the 2 hours before the demo. If you do, step 3 also shows the ATM reason.
- [ ] `APPROVAL_MODE=app` on Vercel (the default). The family approves in the family app with Face ID. The Guardian push (`ciba`) is implemented but not verified live, so do not use it in the demo.

iPhone A (Rosa)
- [ ] Debug build of `dev-integration` installed (the test bank button exists only in debug builds).
- [ ] Paired: dashboard, make a pairing code, type it on the phone. Home says "You're safe".
- [ ] Message Filter on: Settings, Apps, Messages, Unknown and Spam, "Check With Us".
- [ ] Call labels on: Settings, Apps, Phone, Call Blocking and Identification, "Check With Us".
- [ ] The Google Voice number is in `scam-numbers.local.json`, and the app was opened once after install so the list loaded.
- [ ] The Google Voice number is NOT a saved contact, and has not texted this phone before (iOS skips the filter for a sender already in Spam, [DECISIONS 28](../ml/data/DECISIONS.md)).
- [ ] Location set to Always and Precise. At the expo table, tap "Make this spot a test bank". The debug panel says "Watching" 1 or more banks.
- [ ] Live Activities allowed. Volume up. Focus and Do Not Disturb off.
- [ ] No held payment is waiting (the phone allows one at a time).

iPhone B (family)
- [ ] Family role. Signed in with the Auth0 approver account. Joined Rosa's circle.
- [ ] Face ID works for the app (passcode is the fallback).
- [ ] Money tab says not frozen. If frozen from the last run: tap Unfreeze (needs a fresh sign-in).

MacBook
- [ ] checkwith.us/dashboard signed in, on Rosa's circle.
- [ ] Terminal open in `web/` with `.env.local`. Type `npm run demo:atm` and do not press Enter yet.
- [ ] A tab with the README "Model evaluation" and "Tiger Data performance" tables.
- [ ] Google Voice signed in, with the scam text typed and ready. TODO(Dev): test the exact text on iPhone A once; use one that lands in Spam.
- [ ] Wi-Fi works on all devices. A phone hotspot is ready as backup.

Suggested scam text (made up, test it first): `FL Toll Services: unpaid toll balance of $6.89. Pay today to avoid a $50 late fee: https://fl-toll-pay.example`

## The script

Times are cumulative. The script ends at 2:45, so 15 seconds are left as buffer. Say the lines in quotes; do the steps in bold.

### 0:00 Hook (10 s)
"Every scam tool asks older adults to do something new. checkwith.us asks them to do nothing. The family does the work. This is Rosa's phone, and this is her family's."

### 0:10 Step 1: a scam text never reaches her (20 s)
1. **Google Voice: send the scam text to iPhone A.**
2. **Hold up iPhone A: open Messages.** The inbox has no new text. Open the Spam folder to show it there.

"Our own scam model runs inside the Message Filter, on the phone. It is 1 MB. Her texts never leave the phone."

### 0:30 Step 2: a scam call rings as "Possible scam" (20 s)
1. **iPhone A: open Check With Us so it is on screen.**
2. **Google Voice: call iPhone A.**
3. **Show the incoming call screen:** "Possible scam".
4. **Answer, then go straight back to Check With Us and keep it in the foreground.** The bank alert for "call starts while already inside a bank" only fires while the app is open. The scammer stays on the line from here on.

"Rosa answers anyway. Scammers are persuasive. So we protect the money, not just the phone."

### 0:50 Step 3: a gift card during the call pauses (35 s)
1. **iPhone A: tap "Pay a bill", then "Gift card store". Enter 200. Tap "Next", then "Yes, pay".**
2. iPhone A shows "Paused, waiting for family" and "Your money is safe. Your family will call you."
3. **iPhone B: open Approvals.** The held payment shows the amount, the payee and the reasons, including "Gift card purchase", "Someone they have not paid before" and "Paid while on a phone call". Point at the short note.

"Fixed code rules held this, not an AI. The AI can add a reason; it can never remove one. The note was written on Rosa's phone by Apple's on-device model, from facts our code picked."

4. **iPhone B: tap Deny.**
5. **Show iPhone A.** The screen and the lock-screen card change to "Stopped. Your family said no." Nothing reached the bank.

"Deny is one tap. Approve needs Face ID, so a stolen phone cannot release money."

### 1:25 Step 4: she is at a bank during the call (20 s)
1. **iPhone B: open Alerts.** Pull down to refresh. The alert reads "At a bank (Test branch) while on a phone call."

"The scammer sends her to the bank. Her phone watches the nearest bank and ATM locations from Capital One's Nessie. Nessie's banks are all near Washington, DC, so we placed a test bank at this table. Only the bank's name is sent, never her location."

2. **Hang up the Google Voice call.**

### 1:45 Step 5: ATM cash, then a gift card (25 s)
1. **MacBook: press Enter on `npm run demo:atm`.** It prints "ATM cash $200 at ...".

"Rosa takes $200 cash at an ATM. That is a real Nessie withdrawal."

2. **iPhone A: Pay a bill, Gift card store, 200, Yes, pay.**
3. **iPhone B: Approvals.** New reason: "Cash at an ATM, then a gift card. Scammers often ask for this."

"Each step looks normal alone. Together they are the classic scam script. Tiger Data finds the pair with a time-window query on her spending."

4. **iPhone B: tap Deny.**

### 2:10 Step 6: Freeze (20 s)
1. **iPhone B: Money tab. Tap "Freeze money now", then "Freeze".** It shows "Frozen. Money is in the safe account."

"One tap moves her whole spending balance to a vault account with a Nessie transfer. It runs exactly once, even if you tap twice. Every new payment now waits for the family."

### 2:30 Close: the numbers (15 s)
1. **MacBook: show the README tables.**

"On a million rows in Tiger Data, continuous aggregates make 3 years of weekly totals for 200 families 13.8 times faster, and compression makes the data 3.2 times smaller. Our 1 MB on-device model catches 96.0% of real scam texts with 2.4% false holds. checkwith.us."

### If there is time, or a judge asks
Unfreeze first if step 6 ran, and make sure no call is active (a call adds a hold an allowance never lifts).
- **Approve with Face ID:** iPhone A: Pay a bill, Neighborhood Pharmacy (a known payee), 350, Yes, pay. It holds because $350 is over the $300 limit (it may also show "Much more than they usually spend on this"). iPhone B: Approve, Face ID. iPhone A shows "Paid".
- **Allowance:** iPhone A: Pay a bill, City Power & Light, 350, Yes, pay. It holds as "Over the limit you set"; iPhone B: Deny. Then iPhone B: Allowances, Add, Utilities, up to $400, until Nov 30, Save (needs a fresh sign-in). iPhone A pays City Power & Light $350 again: it goes through with no hold. The allowance lifts only the limit and "more than usual" reasons for a known payee, never gift card, new payee, call or scam-check reasons.
- **Dashboard:** MacBook: reload checkwith.us/dashboard to show the waiting payments and the spending chart.

## If X fails, say Y

| If this fails | Do this | Say this |
| --- | --- | --- |
| Scam text lands in the inbox | Move on. Show the model table later. | "iOS only sends unknown senders to the filter. Here are the model's scores on 884 real texts." |
| Call shows no "Possible scam" label | Answer and continue with step 3. | "iOS reloads the call list on its own schedule. The payment rule still knows she is on a call." |
| Payment does not reach the server | Check `https://checkwith.us/api/health`. Switch to the hotspot. | "No connection means nothing is paid. The app fails closed." |
| Family app does not show the hold | Pull down to refresh (it polls every 10 seconds). Or reload the dashboard on the MacBook. | "The family can also act from the web dashboard." |
| Face ID fails | Use the passcode. | "The phone's passcode is the fallback, like any banking app." |
| No on-device note | Continue. | "When Apple Intelligence is off, the family sees the plain facts instead." |
| Bank alert does not arrive | Bring Check With Us to the foreground on iPhone A. If still nothing: debug panel, turn on "Pretend I'm on a call". Then refresh Alerts. | "Nessie's banks are in DC, so we use a test bank here. The geofence fires when she is inside one during a call." |
| `npm run demo:atm` fails | Skip to step 6. | "The rule is a two-hour window query on the Tiger Data hypertable: ATM cash, then a gift card." |
| Freeze fails | Show the error, then move to the close. | "Freeze is one Nessie transfer, recorded exactly once, so a retry never moves money twice." |
| Step 3 already shows the ATM reason | Continue. | "We ran this demo earlier, so her ATM cash from then still counts." |

## Reset between demos (2 minutes)

1. Deny or let expire every held payment.
2. iPhone B: Money tab, Unfreeze (fresh sign-in).
3. End any call on iPhone A.
4. Send the next scam text from a Google Voice number that has not texted iPhone A before, or accept that step 1 may show it in Spam already.
