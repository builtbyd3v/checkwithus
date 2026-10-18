# Research: scams against older adults, and designing for them

- Older adults lose more per scam, and the biggest losses are growing fastest. So we protect the payment itself, not only the inbox.
- Phone scams have the highest median loss. Bank transfers and crypto lose the most money in total. Gift cards are among the most often reported payment methods for impersonation, tech support and romance scams. Each one is a fixed hold rule in our code.
- Scammers win by rushing people before they can talk to family. So a held payment pauses and the family decides.
- Older users read slower, tap less precisely and blame themselves for errors. So the older adult's screens use big text, big buttons, plain words and one action per screen.
- Every number below is quoted from a source we opened and read on Oct 17, 2026.

## How we did the research

We read government data on fraud (FTC, FBI IC3, CFPB) and usability research on older users (Nielsen Norman Group, Apple Human Interface Guidelines). For each finding we wrote down one change to the product. Quotes are exact. Page numbers are the printed page numbers in the PDF.

"Older adults" means people 60 and over in the FTC and FBI data, and 65 and over in the NN/g studies.

## Part 1: What the data says about scams

### 1. Losses are growing fast, and big losses drive them

- **Finding:** Reported fraud losses by older adults grew four times from 2020 to 2024, and a few very large losses make up most of the money.
- **Source:** FTC, *Protecting Older Consumers 2024-2025: A Report of the Federal Trade Commission*, December 2025, pp. 19-20. https://www.ftc.gov/system/files/ftc_gov/pdf/P144400-OlderAdultsReportDec2025.pdf
  - "reported fraud losses by older adults increased from about $600 million in 2020 to $2.4 billion in 2024, a 300% increase."
  - "While these reports were relatively rare at 5% of older adults' loss reports in 2024, they accounted for 68% of their aggregate reported losses."
- **Source:** FBI, *2025 IC3 Annual Report*, section "IC3 Elder Fraud: Complaints filed by Individuals 60+", p. 44. https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf
  - For 2025, people 60+ filed "201,266 Complaints" with "$7.748 Billion in Losses", a "$38,500 Average Loss", and "12,444 Complainants Lost > $100K".
- **Context:** FTC, *Consumer Sentinel Network Data Book 2024*, March 2025, p. 10, for all ages: 2,600,678 fraud reports, $12,537,194,708 total reported loss, $497 median loss. https://www.ftc.gov/system/files/ftc_gov/pdf/csn-annual-data-book-2024.pdf
- **What we built because of it:** Large payments pause. Any payment over the family's limit ($300 by default) holds, and so does any payment more than 3 times what this person usually spends in that category (`web/lib/rules.ts`, `over_limit` and `unusual_spending`). Large amounts need 2 family approvals, not 1.

### 2. Scams that start with a phone call cost the most per person

- **Finding:** Phone scams have the highest median loss for older adults, and for people 80 and over the phone is the main way scams start.
- **Source:** FTC, *Protecting Older Consumers 2024-2025*, December 2025, p. 25. https://www.ftc.gov/system/files/ftc_gov/pdf/P144400-OlderAdultsReportDec2025.pdf
  - "reported median individual losses remained far higher for phone fraud at $2,210, compared to $650 for fraud originating on social media."
  - For people 80 and over: "this age group reported far higher losses and filed far more loss reports on scams that started with a phone call compared to other methods of contact".
- **What we built because of it:**
  - Payment during a call: any payment started while the phone is on a call holds (`during_call` in `web/lib/rules.ts`). Before the payment goes, the confirm screen says "You are on a phone call. We will ask your family first." (`ConfirmView` in `ios/CheckWithUs/CheckWithUs/ContentView.swift`).
  - Known scam numbers ring as "Possible scam" (`ios/CheckWithUs/CallDirectory/CallDirectoryHandler.swift`).
  - Bank while on a call: if the phone is at a bank or ATM during a call, the family gets an alert (PR #34, open).

### 3. Gift cards are how impersonators ask to be paid

- **Finding:** Gift cards are the payment method older adults report most often for impersonation, tech support and romance scams.
- **Source:** FTC, *Protecting Older Consumers 2024-2025*, December 2025, p. 27. https://www.ftc.gov/system/files/ftc_gov/pdf/P144400-OlderAdultsReportDec2025.pdf
  - "their reported gift card payments were overwhelmingly on impersonation scams."
  - "Gift cards were once again the most frequent payment method reported by older adults on several common fraud types, including government impersonation scams, tech support scams, romance scams, and family and friend impersonation scams."
- **What we built because of it:** Gift card holds. Every gift card purchase pauses for the family, whatever the amount and whoever the payee (`ALWAYS_HOLD` in `web/lib/rules.ts`). The family sees the reason "Gift card purchase", and the phone's note explains why gift cards are risky (`ios/CheckWithUs/CheckWithUs/Explainer.swift`).

### 4. Bank transfers and crypto lose the most money in total

- **Finding:** Bank transfers and cryptocurrency cause the largest total losses for older adults, and crypto losses grew more than twentyfold since 2020.
- **Source:** FTC, *Protecting Older Consumers 2024-2025*, December 2025, pp. 26-27. https://www.ftc.gov/system/files/ftc_gov/pdf/P144400-OlderAdultsReportDec2025.pdf
  - "Since 2020, reported fraud losses by older adults have increased over eightfold on scams using bank transfer as the payment method and over twentyfold on scams using cryptocurrency as the payment method."
- **What we built because of it:** Crypto and wire transfers always pause (`crypto` and `wire_transfer` in `web/lib/rules.ts`). A payee the person has never paid before also pauses (`new_payee`).

### 5. "Take out cash, then go to this machine"

- **Finding:** Scammers tell people to take cash out of the bank, then send them to a Bitcoin ATM (BTM). Older adults report these losses far more often than younger adults.
- **Source:** FTC Data Spotlight, *Bitcoin ATMs: A payment portal for scammers*, September 3, 2024. https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2024/09/bitcoin-atms-payment-portal-scammers
  - "In the first half of the year, people 60 and over were more than three times as likely as younger adults" ... "to report a loss using a BTM." (The year is 2024.)
  - "They direct you to go to your bank to take out cash." "Next, they send you to a nearby BTM location"
  - For all ages, "Phone calls were the initial contact method in about 47% of these reports" (footnote 11). "These reports" means all Bitcoin ATM loss reports, not only older adults. The spotlight does not say the scammer stays on the phone during the cash withdrawal.
- **Source:** FTC, *Protecting Older Consumers 2024-2025*, December 2025, p. 24: bank impersonators tell people "to transfer money or deposit cash into Bitcoin ATM machines to keep it “safe.”"
- **What we built because of it:**
  - The "ATM cash, then a gift card" hold (PR #32, open). This rule is our own heuristic. No source above documents that exact sequence. It combines two documented behaviors: scammers tell people to take out cash (this spotlight), and impersonators demand gift cards (finding 3). The FTC report lists both demands side by side: scammers "convince people to buy gift cards and share the codes, send cash or gold, transfer money, or put cash into a cryptocurrency ATM" (p. 29).
  - The bank-while-on-a-call alert tells the family only the bank's name, never the exact location (PR #34, open; screen in `docs/gallery/04-older-adult-bank-safety.png`).

### 6. Scammers rush people so they cannot ask family

- **Finding:** Older adults told the FTC that threats made them act before they could think or call family.
- **Source:** FTC, *Protecting Older Consumers 2024-2025*, December 2025, pp. 29-30. https://www.ftc.gov/system/files/ftc_gov/pdf/P144400-OlderAdultsReportDec2025.pdf
  - "The threats of legal action against the older adults caused them to act before they had time to consider what was being asked of them, or before they could reach out to consult with family, friends, or real law enforcement."
- **Source:** FTC Data Spotlight, *False alarm, real scam: how scammers are stealing older adults' life savings*, August 7, 2025. https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2025/08/false-alarm-real-scam-how-scammers-are-stealing-older-adults-life-savings
  - From 2020 to 2024, "the number of reports from older adults who lost $10,000 or more to these scams increased more than fourfold".
  - The FTC's advice: "Never transfer or send money to anyone, no matter who they say they are, in response to an unexpected call or message."
- **What we built because of it:**
  - The pause is the product. A risky payment stops before money moves. The phone says "Paused, waiting for family" and "Your money is safe. Your family will call you." (`OutcomeText` in `ios/CheckWithUs/Shared/PaymentActivity.swift`). The lock-screen card shows the same words (`ios/CheckWithUs/SafeCard/SafeCard.swift`).
  - One big "Ask my family" button on the home screen. It alerts the family and then says "Do not send money to anyone until you talk to them." (`HomeView` and `AskedView` in `ContentView.swift`).

### 7. Family is already the first line of help

- **Finding:** Family members often report scams for people 80 and over. Regulators give banks examples of practices that can help, such as transaction holds and trusted contacts. The statement does not set new rules or expectations.
- **Source:** FTC, *Protecting Older Consumers 2024-2025*, December 2025, pp. 21 and 27. https://www.ftc.gov/system/files/ftc_gov/pdf/P144400-OlderAdultsReportDec2025.pdf
  - "In 2024, about 16% of reports filed for people 80 and over indicated they were submitted by a person on behalf of the consumer, a far higher rate than any other age group."
  - "most consumers do not report being victimized to anyone other than family and friends."
- **Source:** CFPB, FRB, FDIC, FinCEN, NCUA, OCC and state regulators, *Interagency Statement on Elder Financial Exploitation*, December 2024, pp. 3-4. https://files.consumerfinance.gov/f/documents/cfpb_interagency-statement-on-elder-financial-exploitation_2024-12.pdf
  - Banks "have used transaction holds and disbursement delays to prevent consumer losses".
  - "Supervised institutions may also consider procedures for older adult account holders and their designated representatives to establish the legitimacy of a potentially suspicious transaction."
  - "an account holder might identify one or more family members, attorneys, accountants, or other trusted individuals and authorize the supervised institution to contact them".
- **Source:** CFPB, *Financial institutions can help prevent elder financial exploitation with alerts to trusted contacts*, November 2021, p. 1. https://files.consumerfinance.gov/f/documents/cfpb_trusted-contacts-fis_2021-11.pdf
  - "A trusted contact is an emergency financial contact who can step in to help protect the account holder."
- **What we built because of it:** The family does the work. The family circle approves or denies a held payment from Auth0 Guardian push or the dashboard, with amount, payee and reason (#14, #16). Approvers and viewers have different roles. The older adult pairs once with a code (`PairView`) and then has nothing to manage.

### 8. Speed matters: money stopped early can be saved

- **Finding:** When the FBI's Financial Fraud Kill Chain (FFKC) acts on a report from someone 60+, it can freeze about half of the money.
- **Source:** FBI, *2025 IC3 Annual Report*, p. 18. https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf
  - "there were 642 incidents involving victims aged 60+ with a total reported loss of $65,367,648. The FFKC process was able to assist in freezing $32,865,655 of those funds."
- **What we built because of it:** We hold before the money leaves, not after. The family can also tap Freeze, which moves the spending balance to a vault account in one step (#18, PR #32, open).

### 9. Older adults often spot scams themselves

- **Finding:** Most fraud reports from older adults say they lost no money.
- **Source:** FTC, *Protecting Older Consumers 2024-2025*, December 2025, p. 22. https://www.ftc.gov/system/files/ftc_gov/pdf/P144400-OlderAdultsReportDec2025.pdf
  - "about 74% of older adults' fraud reports did not indicate any monetary loss."
- **What we built because of it:** Respect, not alarm. The home screen says "You're safe" and "Your family is looking out for you." Ordinary payments, like a known bill under the family's allowance, go through with no pause (#19). The older adult keeps control of everyday money.

## Part 2: What research says about designing for older users

### 10. Small text and small targets are the most common problems

- **Finding:** Apps often use tiny type and small buttons that older users cannot read or tap well.
- **Source:** Lexie Kane, Nielsen Norman Group, *Usability for Older Adults: Challenges and Changes*, September 8, 2019. https://www.nngroup.com/articles/usability-for-senior-citizens/
  - "Websites and apps with tiny type are common."
  - Buttons and links "are often displayed at a small size that is difficult for older users to click on or tap."
  - NN/g ran three rounds of research (2001, 2013 and 2018-19) with "a total of 123 participants aged 65 and older".
- **Source:** Apple, *Human Interface Guidelines: Accessibility* (last changed June 9, 2025). https://developer.apple.com/design/human-interface-guidelines/accessibility
  - The default control size for iOS is 44x44 pt.
  - "Ideally, give people the option to enlarge text by at least 200 percent".
- **Source:** Apple, *Human Interface Guidelines: Typography* (last changed December 16, 2025). https://developer.apple.com/design/human-interface-guidelines/typography
  - "Make sure your app's layout adapts to all font sizes."
  - "Keep text truncation to a minimum as font size increases."
- **What we built because of it:** Large text and one big button. All text uses Dynamic Type styles (`.largeTitle`, `.title2`), so it grows with the phone's text size. Every screen scrolls, so very large text never cuts off. Main buttons are full width and at least 80 pt tall; Back and links are at least 56 pt tall (`Page` and `BigButton` in `ContentView.swift`).

### 11. Older users are slower, so one step at a time

- **Finding:** Users 65 and older take much longer on the same tasks, so long multistep screens cost them more.
- **Source:** Jakob Nielsen, Nielsen Norman Group, *Usability for Senior Citizens: Improved, But Still Lacking*, May 28, 2013. https://www.nngroup.com/articles/usability-seniors-improvements/
  - "Users aged 65 and older are 43% slower at using websites than users aged 21–55."
- **Source:** Apple, *Human Interface Guidelines: Accessibility*, Assistive Access and Cognitive sections. https://developer.apple.com/design/human-interface-guidelines/accessibility
  - "Break up multistep workflows so people can focus on a single interaction per screen."
  - "Minimize use of time-boxed interface elements."
- **What we built because of it:** One action per screen. Paying a bill is four short screens: who, how much, confirm, result (`ChoosePayeeView`, `AmountView`, `ConfirmView`, `StatusView`). The older adult never races a timer. The only countdown is on the family's side, and if it runs out the payment is blocked, not sent.

### 12. Errors must say how to fix them, because users blame themselves

- **Finding:** Older users make more mistakes, users tend to blame themselves for them, and unclear error messages make it worse. So error messages must be clear and easy to act on.
- **Source:** Lexie Kane, Nielsen Norman Group, *Usability for Older Adults: Challenges and Changes*, September 8, 2019. https://www.nngroup.com/articles/usability-for-senior-citizens/
  - "It's a classic finding in usability research that users blame themselves"
  - "Older users make more mistakes than younger users do."
  - Older users "often had problems reading error messages, either because the wording was obscure or imprecise". (Kane also notes that today's older users are more confident online than the 2001 group, so we design for capable people, not fearful ones.)
- **Source:** Jakob Nielsen, Nielsen Norman Group, *Usability for Senior Citizens: Improved, But Still Lacking*, May 28, 2013. https://www.nngroup.com/articles/usability-seniors-improvements/
  - "focus on the error, explain it clearly, and make it as easy as possible to fix."
- **What we built because of it:** Plain-words reasons. The amount screen shows "Use whole dollars, like 50" or "Type an amount like 84.12", with an example to copy (`AmountView`). A stopped payment says "Your money is safe. Nothing was sent." and never just "Declined". The family sees each hold reason in plain words, such as "Paid while on a phone call" (`HOLD_REASON_LABELS` in `web/lib/rules.ts`).

### 13. Tech words confuse

- **Finding:** Older users are often unsure of technical terms.
- **Source:** Nielsen Norman Group, *Define Techy Terms for Older Users* (no date shown on the page). https://www.nngroup.com/articles/define-techy-words-old-users/
  - "If using web or browser-related terms, consider defining them in place. Avoid using them if they are not necessary."
- **What we built because of it:** The older adult's screens use words people say out loud: "Pay a bill", "Ask my family", "Paused, waiting for family", "Your family said no." There is no "transaction", "authorize" or "merchant". When iOS shows its own location prompt, the Bank safety screen tells the person exactly which buttons to tap (`BankPermissionView`, PR #34).

### 14. Color alone is not enough

- **Finding:** Some people cannot tell colors apart, so state must also show in words and shapes.
- **Source:** Apple, *Human Interface Guidelines: Accessibility*. https://developer.apple.com/design/human-interface-guidelines/accessibility
  - "Convey information with more than color alone."
- **What we built because of it:** Every state has an icon, a headline and a color together: a green shield and "You're safe" (`checkmark.shield.fill` in `HomeView`, `ContentView.swift`), an orange pause symbol and "Paused", a red raised hand and "Stopped" (`OutcomeText.symbol` and `OutcomeText.color` in `PaymentActivity.swift`). VoiceOver reads the family's answer aloud when it arrives (`StatusView`).

## Design steps

The screens below are iPhone simulator screenshots of the real app. They are not mockups.

| Step | Image | Screen | Where in code |
| --- | --- | --- | --- |
| 1. Who uses this phone | [01-role-picker.png](gallery/01-role-picker.png) | Two big buttons: "I have a code from my family" and "I'm family: Sign in" | `RolePickerView`, `RoleViews.swift` (PR #30) |
| 2. Connect once | [02-older-adult-connect.png](gallery/02-older-adult-connect.png) | Type the family's code, one Connect button | `PairView`, `ContentView.swift` |
| 3. Home: you're safe | [03-older-adult-home-safe.png](gallery/03-older-adult-home-safe.png) | "You're safe", one big "Ask my family" button, "Pay a bill" below | `HomeView`, `ContentView.swift` |
| 4. Bank safety setup | [04-older-adult-bank-safety.png](gallery/04-older-adult-bank-safety.png) | Plain-words reason first, then Apple's location prompt | `BankPermissionView`, `BankWatcher.swift` (PR #34) |
| 5. Family: approvals | [05-family-approvals.png](gallery/05-family-approvals.png) | Waiting holds first, each with its reason | `HoldsView`, `FamilyViews.swift` (PR #30) |
| 6. Family: why we paused it | [06-family-why-we-paused.png](gallery/06-family-why-we-paused.png) | Amount, payee, every reason, the phone's note, Deny and Approve | `PaymentDetailView`, `FamilyViews.swift` (PR #30) |

- New design assets: [SVG handoff and design boards](design/handoff.md), including new exploratory sketches, wireframes and visual specifications. They were created after implementation and are labelled accordingly; they are not historical process evidence. Import the SVG frames into Figma when a team workspace is available.

## Limits

- All fraud numbers are reports people chose to file. The FTC says losses reported to it are the "tip of the iceberg".
- We did not run a usability test with older adults this weekend (out of scope in `docs/PLAN.md`). The design rests on the published research above.
