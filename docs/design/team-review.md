# Figma import and native capture guide

Use the six editable SVGs listed in [handoff.md](handoff.md). These are
post-implementation explorations, not evidence of earlier design work or a
completed user study. The PR description tracks completion status.

## Import into the team's Figma file

Create a page named “CheckWith.us — design explorations”. Drag `home.svg`,
`paused.svg`, `asked.svg`, `lock-screen.svg`, `family-approval.svg` and
`dashboard.svg` onto that page. Keep the 390 × 844 dimensions. Select each
imported screen, frame the selection, and name it for the corresponding screen.
Retain an untouched imported copy before editing. SVG import preserves vector
artwork; it does not supply native Figma auto layout, components or prototypes.

Import `sketch-board.svg`, `wireframe-board.svg` and `final-board.svg` onto a
separate page called “Post-implementation comparisons”. Add that phrase to the
page description so the gallery cannot imply these preceded the app.
Check text for font substitution and clipping, and compare against the PNGs in
`docs/gallery/`. If the team shares a file link, include a link to each reviewed
frame in the handoff. Use the team's intended sharing permissions.

## Capture the three missing native states

Build the selected reviewed commit on a real iPhone with the synthetic demo
circle. Capture the app itself, without replacing labels or amounts in an image
editor. Keep pairing codes, account settings and unrelated notifications out.

| Capture | How to reach it | Inspect before saving |
| --- | --- | --- |
| Paused | Submit a synthetic gift-card request on the configured sandbox build | “Paused” and next step visible; large text wraps; OK remains reachable |
| Ask my family | Tap Ask my family once from Home | Confirm the server accepted the alert before claiming it was sent; capture the confirmation |
| Lock-screen card | With the held request active, lock the phone and wake it | Amount/state readable; no unrelated notifications; updates reflect the app's polling limits |

Save original captures as `07-native-paused.png`, `08-native-asked.png`, and
`09-native-lock-screen.png` in `docs/gallery/`. Record device, iOS version,
commit SHA, text size and whether the data/server were sandbox or fixture in
the handoff. Test VoiceOver separately: a screenshot does not establish spoken
announcements. Repeat the main app states at the largest supported text size;
confirm scrolling, safe-area buttons, state words and Reduce Motion behavior.
Do not claim these checks passed until someone performs them on the device.

## Collect genuine family feedback

Ask permission to take notes and to use an anonymized quote in the public
write-up. Do not collect bank details, private texts or a real scammer's number.
Use the same synthetic screens for each conversation. Useful prompts:

1. “What do you think this screen is telling you?”
2. “What would you do next?”
3. “When would you want your family to get involved?”
4. “What feels confusing or worrying?”
5. “What do you expect after tapping Ask my family?”

Record exact words separately from interpretation. For each finding, note the
screen, the participant's consent to quote, the observed difficulty, the actual
change made, and how it was checked afterward. If no change results, say so.
Add consented, anonymized findings to `docs/research.md`; leave unsupplied
interview evidence absent. These short conversations do not establish that the
product is usable for all older adults.
