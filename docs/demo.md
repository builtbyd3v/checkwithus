# checkwith.us demo runbook: judge video shoot + live "show me" steps

- **At the table:** the 30 s judge video plays, then the 2:00 live talk in [pitch.md](pitch.md). That leaves 30 s of buffer inside the 3:00 limit, then 1 minute of judge questions ([RULES.md](RULES.md)).
- **This file covers:** how to set up the devices, how to film each shot of the 30 s judge video, and the live steps to run when a judge says "show me".
- **What we say** lives in [pitch.md](pitch.md). The **Devpost video** (1:30 to 2:00) is separate: [video-script.md](video-script.md).
- **One build:** pin one commit on `main`. Use it for both iPhones and the Vercel deployment.
- The older adult is synthetic (Sam in our scripts). Never use a real person's name or number.

## Cast and props

| Who | Device | Shows |
| --- | --- | --- |
| Sam, the older adult | iPhone A: older adult role, built from the pinned `main` commit | Home, Pay a bill, held screen, lock-screen card |
| The family | iPhone B: family app (family role), same build, signed in with Auth0 | Approvals, Alerts, Allowances, Money (Freeze) |
| Backup for the family | MacBook: www.checkwith.us/dashboard | Waiting payments, spending chart, Tiger Data speed card |
| The scammer | Google Voice (laptop or a third phone) | One scam text, one call |

## Pre-demo checklist (do 15 minutes before)

One build for everything
- [ ] Pin one commit on `main`. Build both iPhones from it. Deploy that commit to Vercel.
- [ ] The commit on the Vercel deployment page matches the pinned commit. (`/api/health` does not show a commit.)
- [ ] `https://www.checkwith.us/api/health` prints `{"ok":true,"database":"reachable"}`. Use `www`: the apex redirects to `www` and drops the app's login token.
- [ ] Migrations on the live database: `cd web && npm run db:migrate` (014 freeze, 015 ATM cash, 016 weekly and per-payee aggregates, 017 ledger credits, 020 payment initiator).
- [ ] `DEMO_BANK_LOCATIONS` is set on Vercel to a spot at the expo table, for example `[{"name":"SwampHacks Demo Bank","lat":29.6463,"lng":-82.3478}]`. Confirm the coordinates on site, redeploy after changing it, then relaunch the app on iPhone A.
- [ ] `npm run smoke:demo` passes (a $350 City Power & Light bill pays with no push while the allowance exists, and holds when it is revoked; runs on a throwaway schema).
- [ ] If showing the bill-pay agent: `AUTH0_AGENT_CLIENT_ID` and `AUTH0_AGENT_CLIENT_SECRET` are in the MacBook's `.env.local`, and a second terminal has `npm run agent:bills -- --within 14` typed, not run. Run it only after `demo:reset`. Verified live on Oct 17 (it paid the $350 water bill).
- [ ] `npm run demo:reset -- --live` on the real demo circle (only there; without `--live` it refuses anything but a throwaway `wt_*` schema). It reseeds the demo circle, clears held payments, unfreezes, clears recent ATM cash, and grants the utilities allowance up to $400 until Nov 30.
- [ ] Do NOT run `npm run demo:atm` after the reset until the ATM step. If you do, the first gift card also shows the ATM reason.
- [ ] `APPROVAL_MODE=app` on Vercel (the default). The family approves in the family app, which asks for Face ID first. The Guardian push (`ciba`) is built and tested, and off in the demo. Keep it off.

iPhone A (Sam)
- [ ] The pinned build installed. A debug build also has the "Make this spot a test bank" and "Pretend I'm on a call" backups.
- [ ] Paired: make a pairing code in the family app (Settings) or the dashboard, type it on the phone. Home says "You're safe".
- [ ] Message Filter on: Settings, Apps, Messages, Unknown and Spam, "Check With Us".
- [ ] Call labels on: Settings, Apps, Phone, Call Blocking and Identification, "Check With Us".
- [ ] The Google Voice number is in `scam-numbers.local.json`, and the app was opened once after install so the list loaded.
- [ ] The Google Voice number is NOT a saved contact, and has not texted this phone before (iOS skips the filter for a sender already in Spam, [DECISIONS 28](../ml/data/DECISIONS.md)).
- [ ] Location set to Always and Precise. The phone is within 150 m of the `DEMO_BANK_LOCATIONS` spot. Backup in a debug build: tap "Make this spot a test bank"; the debug panel says "Watching" 1 or more banks.
- [ ] Live Activities allowed. Volume up. Focus and Do Not Disturb off.
- [ ] No held payment is waiting (the phone allows one at a time).

iPhone B (family)
- [ ] Family role. Signed in with the Auth0 approver account. Joined the demo circle.
- [ ] Face ID works for the app (passcode is the fallback). The phone has a passcode set.
- [ ] Money tab says not frozen, and Allowances shows "Utilities, up to $400" (both from `demo:reset`).
- [ ] Freeze is one tap with no fresh sign-in. Sign in again on iPhone B right before a judge's unfreeze or allowance step; those need an Auth0 sign-in from the last 5 minutes.

MacBook
- [ ] www.checkwith.us/dashboard signed in, on the demo circle.
- [ ] Terminal open in `web/` with `.env.local`. Type `npm run demo:atm` and do not press Enter yet.
- [ ] A tab with the README "Model evaluation" and "Tiger Data performance" tables.
- [ ] The 30 s judge video downloaded and open, ready to play full screen with sound off.
- [ ] Google Voice signed in, with the scam text typed and ready. Test the exact text on iPhone A once; use one that lands in Spam.
- [ ] Wi-Fi works on all devices. A phone hotspot is ready as backup.

Suggested scam text (made up, test it first): `FL Toll Services: unpaid toll balance of $6.89. Pay today to avoid a $50 late fee: https://fl-toll-pay.example`

## Film the 30 s judge video

The shot list and captions are in [pitch.md](pitch.md). Film each shot as its own clip on the real phones, then cut them together. Captions only, no voiceover. Run `demo:reset` before you start filming.

| Shot | Do this |
| --- | --- |
| 1. Scam text caught (4 s) | Google Voice: send the scam text to iPhone A. Film iPhone A: open Messages. The inbox has no new text. Open the Spam folder to show it. |
| 2. Call labeled (4 s) | Open Check With Us on iPhone A. Google Voice: call iPhone A. Film the "Possible scam" call screen. Answer, then go back to Check With Us. Keep the call on. |
| 3. Paused and denied (8 s) | iPhone A: Pay a bill, Gift card store, 200, Next, Yes, pay. Film "Paused, waiting for family". Film iPhone B: Approvals, the reasons, tap Deny. Film iPhone A's lock screen: "Stopped. Your family said no." Hang up the call. |
| 4. Cash, then gift card (6 s) | MacBook: press Enter on `npm run demo:atm`. iPhone A: Pay a bill, Gift card store, 200, Yes, pay. Film iPhone B's new reason: "Cash at an ATM, then a gift card." Tap Deny. |
| 5. Freeze (5 s) | iPhone B: Money tab, "Freeze money now", then "Freeze". Film "Frozen. Money is in the safe account." |
| 6. Logo (3 s) | The checkwith.us logo card. |

Film shot 4 at least 2 hours after any earlier `demo:atm`, or run `demo:reset` first. Otherwise shot 3 also shows the ATM reason.

## Live "show me" steps

Use these when a judge asks to see something during the talk or the questions. Each takes 10 to 20 s. Pick the one that matches the judge's sponsor.

| Judge asks | Do this | Sponsor |
| --- | --- | --- |
| "Show me a hold" | iPhone A: Pay a bill, Gift card store, 200, Yes, pay. iPhone B: Approvals shows the amount, payee and reasons. Tap Deny. iPhone A changes to "Stopped". | Auth0, Easy On The Eyes |
| "Show me the approval" | iPhone A: Pay a bill, Neighborhood Pharmacy, 350, Yes, pay. It holds (over the default $300 limit). iPhone B: Approve, Face ID. iPhone A shows "Paid". | Auth0 |
| "Show me Nessie" | Freeze on iPhone B (one Nessie transfer to the vault). Or press Enter on `npm run demo:atm` (a real sandbox withdrawal). | Nessie |
| "Show me the allowance" | iPhone B: Allowances shows "Utilities, up to $400, until Nov 30". iPhone A: Pay a bill, City Power & Light, 350, Yes, pay. It shows "Paid", with no hold and no push. Revoke the allowance and pay again: now it holds. | Auth0, Nessie |
| "Show me the agent" | MacBook: press Enter on `npm run agent:bills -- --within 14`. It prints "Signed in as the bill-pay agent (scope: pay:bills)". Reload the dashboard: "Paid by the bill agent under your Utilities allowance". | Auth0 |
| "Show me Tiger Data" | MacBook: the dashboard speed card, then the README "Tiger Data performance" table. | Tiger Data |
| "Show me the bank alert" | During a call, with Check With Us open on iPhone A: iPhone B, Alerts, pull down. "At a bank (SwampHacks Demo Bank branch) while on a phone call." | Nessie |
| "Show me the model" | MacBook: the README "Model evaluation" table. | Privacy (Q&A) |
| "Show me the design" | iPhone A at the largest text size. Then the gallery and [design-principles.md](design-principles.md). | Easy On The Eyes |

Unfreeze before any payment step if Freeze ran. End any call before the allowance step (a call adds a hold that an allowance never lifts).

## If X fails, say Y

| If this fails | Do this | Say this |
| --- | --- | --- |
| The judge video does not play | Run "Show me a hold" live. | "Let me show you on the real phones." |
| Scam text lands in the inbox | Move on. Show the model table later. | "iOS only sends unknown senders to the filter. Here are the model's scores on 884 real texts." |
| Call shows no "Possible scam" label | Answer and continue. | "iOS reloads the call list on its own schedule. The payment rule still knows they are on a call." |
| Payment does not reach the server | Check `https://www.checkwith.us/api/health`. Switch to the hotspot. | "No connection means nothing is paid. The app fails closed." |
| Family app does not show the hold | Pull down to refresh (it polls every 10 seconds). Or reload the dashboard on the MacBook. | "The family can also act from the web dashboard." |
| Face ID fails | Use the passcode. | "The phone's passcode is the fallback, like any banking app." |
| No on-device note | Continue. | "When Apple Intelligence is off, the family sees the plain facts instead." |
| Bank alert does not arrive | Bring Check With Us to the foreground on iPhone A. Debug build: tap "Make this spot a test bank", or turn on "Pretend I'm on a call". Then refresh Alerts. | "Nessie's banks are in DC, so we add a demo bank here. The geofence fires when the phone is inside one during a call." |
| `npm run demo:atm` fails | Skip it. | "The rule is a two-hour window query on the Tiger Data hypertable: ATM cash, then a gift card." |
| Freeze fails | Show the error, then move on. | "Freeze is one Nessie transfer, recorded exactly once, so a retry never moves money twice." |
| A gift card already shows the ATM reason | Continue. | "We ran this demo earlier, so the ATM cash from then still counts." |

## Reset between judges (2 minutes)

1. End any call on iPhone A.
2. MacBook: `npm run demo:reset -- --live`. It clears holds, unfreezes, clears ATM cash and re-grants the allowance.
3. iPhone B: pull down to refresh. Money tab says not frozen; Allowances shows utilities up to $400.
4. Put the judge video back at 0:00.
5. For a live scam text, use a Google Voice number that has not texted iPhone A before. Otherwise it may already be in Spam.

## Dashboard-only backup footage

[38-second synthetic UI clip](gallery/dashboard-backup.webm) and [captions](gallery/dashboard-backup.srt). This records the local dashboard fixture, not a live payment or Guardian push. It can cover the dashboard if devices are unavailable; use real-phone footage for the text, call and older adult shots. Re-recording instructions: [dashboard-backup.md](gallery/dashboard-backup.md).
