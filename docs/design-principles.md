# Design principles

- Six rules shape every screen the older adult sees, and the family screens that back them up.
- Each rule comes from a finding in [research.md](research.md), cited by its number there.
- Each rule points to the real SwiftUI view that follows it.
- Implementation references describe `rishon` in PR #54; they do not establish that the restored `main` branch or deployed site includes these screens.

## 1. The family does the work

**Rule:** The older adult never has to judge a scam. Code holds the risky payment, and the family decides.

**On screen:** Home says "You're safe" and "Your family is looking out for you." (`HomeView`, `ios/CheckWithUs/CheckWithUs/ContentView.swift`). The family gets the hard part: amount, payee, every reason, then Deny or Approve (`PaymentDetailView`, `FamilyViews.swift`, PR #30). The older adult pairs once with a code and has nothing else to set up (`PairView`).

**Source:** FTC, *Protecting Older Consumers 2024-2025* (2025): threats made people act "before they could reach out to consult with family". CFPB, *Interagency Statement on Elder Financial Exploitation* (2024) and CFPB trusted contacts advisory (2021). Research findings 6 and 7.

## 2. One action per screen

**Rule:** Each screen asks one question and has one main button. A second button, if any, is the safe way out.

**On screen:** Paying a bill is four screens: `ChoosePayeeView` ("Who do you want to pay?"), `AmountView` ("How much to ...?"), `ConfirmView` ("Yes, pay" or "No, go back"), `StatusView` ("OK"). All in `ContentView.swift`. The role picker has two choices and nothing else (`RolePickerView`, `RoleViews.swift`, PR #30).

**Source:** Apple HIG, Accessibility (2025), guidance for Assistive Access mode: "Break up multistep workflows so people can focus on a single interaction per screen." We apply it to every screen the older adult sees. NN/g, Nielsen (2013): users 65 and older are 43% slower. Research finding 11.

## 3. Big text, big targets

**Rule:** All text uses Dynamic Type styles. Main buttons are full width and at least 80 pt tall. Nothing tappable is under 56 pt. Every screen scrolls, so no text is cut off at the largest size.

**On screen:** `BigButton` (`.title.bold()`, `minHeight: 80`) and `Page` (a `ScrollView` with buttons pinned to the bottom) in `ContentView.swift`. The lock-screen card uses the same text styles (`ios/CheckWithUs/SafeCard/SafeCard.swift`).

**Source:** NN/g, Kane (2019): "Websites and apps with tiny type are common." Apple HIG: iOS default control size 44x44 pt, text that can grow "by at least 200 percent", and layouts that adapt "to all font sizes". Research finding 10.

## 4. Plain words, no jargon

**Rule:** Use words people say out loud. No "transaction", "authorize", "merchant" or "Live Activity".

**On screen:** "Pay a bill", "Ask my family", "Paused, waiting for family", "Your family said yes", "Stopped. Your family said no." (`OutcomeText` in `ios/CheckWithUs/Shared/PaymentActivity.swift`). Family reasons read the same way: "Someone they have not paid before", "Paid while on a phone call" (`HOLD_REASON_LABELS` in `web/lib/rules.ts`).

**Source:** NN/g, *Define Techy Terms for Older Users*: "Avoid using them if they are not necessary." Research finding 13.

## 5. Say why, never just no

**Rule:** Every pause says why and what happens next. Every error says how to fix it, with an example.

**On screen:** Before paying during a call: "You are on a phone call. We will ask your family first." (`ConfirmView`). A bad amount: "Use whole dollars, like 50" (`AmountView`). A held payment: "Your money is safe. Your family will call you." The family sees "Why we paused it" with each reason, plus a short note written on the phone (`ios/CheckWithUs/CheckWithUs/Explainer.swift`). The Bank safety screen explains why before Apple's location prompt appears (`BankPermissionView`, `BankWatcher.swift`, PR #34).

**Source:** NN/g, Nielsen (2013): "focus on the error, explain it clearly, and make it as easy as possible to fix." NN/g, Kane (2019): users blame themselves for errors. Research finding 12.

## 6. Calm, not scary

**Rule:** Lead with safety. Show state with an icon and words, never color alone. No timers for the older adult to beat.

**On screen:** Green shield and "You're safe" (`checkmark.shield.fill` in `HomeView`, `ContentView.swift`); orange pause and "Paused"; red raised hand and "Stopped" (`OutcomeText.symbol` and `OutcomeText.color` in `ios/CheckWithUs/Shared/PaymentActivity.swift`). VoiceOver reads the family's answer aloud when it arrives (`StatusView`). The only countdown is on the family's side, and if it runs out, nothing is sent.

**Source:** Apple HIG, Accessibility: "Convey information with more than color alone." and "Minimize use of time-boxed interface elements." FTC (2025): "about 74% of older adults' fraud reports did not indicate any monetary loss", so we treat them as capable, not helpless. Research findings 9, 11 and 14.
