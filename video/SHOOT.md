# Judge video at the table (45 s, live)

- Start: `cd video && npm run player`, then open http://localhost:4545/player/ in Chrome. Press F for fullscreen.
- Camera: press C and pick the camera teammate's iPhone (Continuity Camera, same Apple ID as the laptop) or a USB webcam. Point it over the family actor's shoulder at the family phone.
- The video stops twice and shows "YOUR TURN". The family actor acts on the real phone, says one short line, then the presenter presses Space (or the clicker).
  1. Pause 1: review the held payment, Face ID, tap **Deny**. Line: "It's asking me. I say no."
  2. Pause 2: tap **Freeze**. Line: "One tap. Money's in the vault."
- Backup if anything fails: http://localhost:4545/player/?plain=1 plays the 45 s MP4 straight through.
- Before judges arrive: sign in to Auth0 again on the family phone (Freeze needs a sign-in from the last 5 minutes), and seed a held gift card payment.

# Filming script: the real half of the split screen (30 s and Devpost cuts)

- Film 4 short clips of one family member (F1 to F4). Total screen time: 27 s.
- Shoot landscape, 1080p or 4K, 30 fps. Keep the person in the **middle third** of the frame. The video keeps only the center strip.
- Look slightly to your **right** (toward the animation). It reads as if you are watching Rosa.
- Record 2 extra seconds before and after each action. We trim and frame-match in the edit.
- Drop the files in `video/public/clips/` as `F1.mov`, `F2.mov`, `F3.mov`, `F4.mov`.

## Setup (10 min)

1. Plain light wall behind you. Warm daylight or a lamp in front, not behind.
2. Phone on a tripod or a stack of books, at eye height.
3. Wear a solid color (purple works). No logos.
4. Hold your own phone so its screen faces you, never the camera. The app screens are animated on the right.
5. Silence: we add music and sound later. You do not speak.

## Shots

| Clip | Length | On the right at the same time | What you do |
| --- | --- | --- | --- |
| F1 | 10 s | Rosa watches TV, the scam text goes to Junk, then the "Possible scam" call | At a desk or with coffee. Type, sip, scroll. Busy and calm. You notice nothing. |
| F2 | 4 s | Rosa takes $200 from the ATM | Your phone buzzes. Glance down at it. Your face changes: "Rosa is at a bank, on a call?" Look worried. |
| F3 | 8 s | Rosa's payment pauses, Rosa gets frustrated, then "Stopped" | 0 to 2 s: phone buzzes, you read it. 2 to 4 s: frown, shake your head. 4 to 5.5 s: hold the phone up for Face ID. 5.5 s: tap Deny, clearly. 6 to 8 s: exhale, relief. |
| F4 | 5 s | Coins fly into the vault, "Frozen. Money is in the safe account." | Tap Freeze with one confident tap. Small nod or thumbs up to the camera side. |

The exact frames live in `src/timeline.ts` (`SHOTS`). The Deny tap in F3 must land at 5.5 s, because Rosa's screen flips to "Stopped" then.

## Simulator clips for the Devpost cut (Dev)

Record each with `xcrun simctl io booted recordVideo <name>.mov`, 6 to 9 s each, and drop them in `video/public/clips/`:

1. `sim-rosa-junk.mov`: Rosa's app, scam text in Junk, then the "Possible scam" call.
2. `sim-family-held.mov`: family app, a held payment with plain reasons.
3. `sim-family-approve.mov`: family app, Approve with Face ID.
4. `sim-family-freeze.mov`: family app, Freeze, then "Frozen. Money is in the safe account."
5. `sim-rosa-bigtext.mov`: Rosa's app at the largest text size.

Synthetic Rosa data only. No real names, numbers, tokens or pairing codes on screen.
