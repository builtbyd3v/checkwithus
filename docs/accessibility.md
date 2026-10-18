# Accessibility on the older adult's iPhone

- **Most used by older adults:** Larger Text, Bold Text, Zoom and hearing aids. The app supports all of them with no setup.
- **Hands-free help:** say "Ask my family in Check With Us" to Siri. It works on a locked phone and only sends the ask-family alert. It never moves money.
- **Assistive Access:** the app opts in to full screen, so it shows up under Optimized Apps when family sets up Assistive Access.
- **Voice Control:** every button answers to its visible words. Long buttons also answer to a short word ("Code", "Sign in", "Go back").
- **Display settings:** Bold Text, Increase Contrast, Button Shapes and Reduce Motion all change the app. The colors and theme do not change.

## Feature by feature

Each test takes under a minute. The paths start in Settings > Accessibility.

| Feature | Supported | How | Test on the phone |
| --- | --- | --- | --- |
| Larger Text (Dynamic Type) | Yes | Text styles only. At the largest sizes, icons drop, buttons stack, and only the main button stays pinned. | Display & Text Size > Larger Text. Turn on Larger Accessibility Sizes and drag to max. Open Home. "Ask my family" is whole, and "More below" scrolls to the rest. |
| Bold Text | Yes | System text styles turn bold by themselves. | Display & Text Size > Bold Text. All words get heavier. |
| Increase Contrast | Yes | Every theme color (`Shared/AppTheme.swift`) has a stronger value: darker in light mode, lighter in dark mode. White on the purple button goes from 5.0:1 to 7.6:1. | Display & Text Size > Increase Contrast. Warning and error text and the purple button get stronger. |
| Button Shapes | Yes | Text-only buttons (Back, More below, Turn on scam call warnings, Open Settings) get a bordered shape. Big buttons are bordered already. | Display & Text Size > Button Shapes. Back gets a light purple shape. |
| Reduce Motion | Yes | The pulse on "Waiting for your family" stops, and "More below" jumps without animation. | Motion > Reduce Motion. Make a held payment. The icon stays still. |
| VoiceOver | Yes | Labels on every control. Icons are hidden. Each status reads as one sentence. A payment decision is announced when it changes. | Triple-click the side button (if set) or turn on VoiceOver. Swipe through Home and hear "You're safe". |
| Voice Control | Yes | Buttons answer to their visible words, plus short extra words for long ones. There are no icon-only buttons. | Turn on Voice Control. Say "Show names", then "Tap Ask my family". |
| Spoken Content (Speak Screen) | Yes, no work | All words are real text. | Spoken Content > Speak Screen. Swipe down with two fingers from the top. |
| Zoom | Yes, no work | No fixed screen sizes. | Zoom on. Double-tap with three fingers. |
| Assistive Access | Full screen | `UISupportsFullScreenInAssistiveAccess` in `CheckWithUs-Info.plist`. Our screens are already one action each. A separate `AssistiveAccess` scene is not built. | Assistive Access > Apps > add Check With Us. The app is listed as optimized and fills the screen. |
| Siri and App Shortcuts | Yes | `AskFamilyIntent` (App Intent) plus an App Shortcut phrase. `authenticationPolicy = .alwaysAllowed`, so it works locked. | Say "Hey Siri, ask my family in Check With Us". The family gets an Alerts entry. Shortcuts can add it to the Action button. |
| Dictation | Partly | Works in the family code field. The amount field uses the number pad, which has no microphone. | Tap the code box and the microphone key. Say the code. |
| Hearing (Live Captions, hearing aids) | Yes, no work | The app makes no sound. Everything is on screen or on the lock-screen card. The family's call back is a normal phone call, so Live Captions and hearing aids work for it. | Hearing Devices pairs as usual. Live Captions shows the family's call. |
| Guided Access | Works | Family can lock the phone to this app. It is not on by default, because it also blocks calls to other apps. | Guided Access on. Open the app and triple-click the side button. |
| Haptics | Not yet | The status is spoken by VoiceOver and shown big on screen. | Later: a success or warning haptic when the family decides. |

## Locked to the older adult

- A paired phone always opens the older adult screens, whatever role was picked before. There is no on-device way out.
- Only the family can release it: Settings > "Unpair her phone" in the family app, or "Unpair their phone" on the dashboard. Both need an approver and a fresh sign-in.
- After that, her phone gets 401 on its next request. It deletes the Keychain token and goes back to the first screen.
