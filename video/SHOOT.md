# Judge video (44 s): 2 clips to film

The left half is the family phone from 9.0 s to 38.0 s. Film these 2 clips, drop them in `video/public/clips/`, and I splice them in.

| Clip | Covers | Hold arrives | Tap at | What happens (over the shoulder, on the family phone) |
| --- | --- | --- | --- | --- |
| J1.mov | 9.0 to 23.5 s (14.5 s) | 10.5 s in | 14.0 s in | Idle on the home screen. The $200 gift card hold arrives. Read it, tap **Deny**. |
| J2.mov | 23.5 to 38.0 s (14.5 s) | 7.5 s in | 11.0 s in | Idle on the home screen. The $420 groceries hold arrives. Read it, Face ID, tap **Approve**. Hold the result 3 s. |

The two clips fill the whole left half. I trim the idle start, so its exact length does not matter, but it must be long enough.

- Film landscape, 1080p or 4K, 30 fps. Keep the phone screen in the center. The clip fills a 960 x 800 box, so the outer edges get cropped.
- Record 2 extra seconds after each clip. I trim each clip to fit.
- No talking needed. The video has music and captions.
- iPhone camera: Settings > Camera > Record Video: 1080p at 30 fps, HDR Video off (HDR looks washed out in the render).
- Land each tap about 3.5 s after the hold arrives. The right half shows the result right after the gap.
- Before filming: sign in to Auth0 on the family phone. During each take, a teammate off camera triggers the payment ($200 gift card for J1, $420 groceries for J2) so the hold arrives live.

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
