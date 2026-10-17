# Native iPhone visual refresh

The actual SwiftUI app now applies the supplied
[DESIGN.md direction](style-reference.md), separately from the earlier web
dashboard refresh. `AppTheme.swift` defines adaptive colors, white/ink surfaces,
18/28-point cards, 10-point controls, rounded system typography, and shared
primary/secondary button rendering. The system font keeps Dynamic Type support;
no downloaded fonts or new dependencies are required.

## Where it applies

- Older adult: role selection, pairing, Home, payee selection, amount entry,
  confirmation, paused/settled payment states, family-contact confirmation and
  bank-permission explanation. Main buttons retain their 80-point minimum, the
  pinned action area, scrolling and large-text rearrangement.
- Family: sign-in, join circle, approvals overview and payment detail, alerts,
  Money, allowances and settings. The overview uses the actual held-payment count;
  Money uses the existing API balance. No new sample balances are inserted into
  production views. Approve is blue; Deny remains an explicit destructive action.
  Initial circle loading has a progress card and a retry action if the request
  fails, instead of immediately presenting the family tabs with no circle loaded.
- App icon remains the user-supplied purple/yellow logo. SafeCard/lock-screen and
  Dynamic Island layouts are unchanged in this pass; their shared outcome words
  remain the same.

Light colors follow the cool canvas, white cards and navy text of the reference.
Dark Mode has its own canvas, surfaces and readable text. Primary blue is darkened
to `#2468c9` for white-label contrast; native links use a lighter blue in Dark Mode.
Status always includes words, with green/red/amber reserved for outcomes and
warnings. The repeating waiting pulse is removed. Existing VoiceOver outcome
announcements, Reduce Motion scrolling behavior and native controls remain.

Payment, authentication, Face ID/passcode, API, permissions, allowance, freeze,
polling and money-conversion logic are unchanged. The new Swift file sits in the
project's existing synchronized app folder; no target membership edits are needed.

## Xcode and device review

This change was prepared on Windows, without Xcode or an iPhone simulator.
The opaque text/background palette pairs measure at least 4.51:1 across the
defined canvas, surface and panel colors in both modes. White on primary blue
is 5.39:1 and white on the navy summary is 14.50:1. This is token validation,
not a rendered native accessibility audit; disabled controls and decorations
are outside those text measurements. Accent JSON and Git whitespace checks pass.
Compilation, native
rendering and device accessibility still require Dev's Mac and signing account.
Do not treat the older gallery captures as screenshots of this refresh.

Build the PR's exact commit with the CheckWithUs scheme in Debug and Release.
Inspect `AppTheme.swift`'s component preview and the Home preview at largest text
in Dark Mode. For app screenshots, the existing Debug launch arguments are:

| Screen | Scheme launch arguments |
| --- | --- |
| Older adult Home | `-role protected -preview home` |
| Payee list | `-role protected -preview payees` |
| Confirmation | `-role protected -preview confirm` |
| Paused / denied / contacted family | `-role protected -preview waiting` / `denied` / `asked` |
| Family approvals / detail | `-role family -familyPreview holds` / `detail` |
| Family money / frozen | `-role family -familyPreview money` / `frozen` |
| Alerts / allowances / settings | `-role family -familyPreview alerts` / `allowances` / `settings` |

For slash-separated values, use the full argument prefix and one value per run.
These inherited Debug fixtures are for visual review, not live-bank verification.
Use a clean test simulator/device and remove launch arguments afterward before
testing real sign-in or payment behavior. Do not perform real payment actions
merely to capture a screen.

On a small iPhone and at the largest accessibility text size, verify: no clipped
amounts or mid-word buttons; scrolling reaches every action; the keyboard leaves
Next/Back reachable; two family decision buttons stack; VoiceOver reads real
outcomes and ignores decorative icons; dark backgrounds and disabled controls
remain distinguishable. Check the sign-in sheet, grant-allowance form and tab bar
on-device. Capture the new native screens only after that review passes.

AI tool: Codex for the SwiftUI styling and code review. This document does not
claim a successful Xcode build or device test.
