import XCTest
@testable import GuardKit

final class RulesTests: XCTestCase {
    let rules = ScamRules()

    private func fired(_ text: String) -> [String] { rules.hits(text).map(\.id) }

    func testScamsFireTheRightRule() {
        let cases: [(String, String)] = [
            ("Hi it's Pastor Mike. Can you buy 4 Apple gift cards and text me the codes? I'll pay you back", "gift_card"),
            ("Pay the $500 fee with Google Play gift cards to avoid suspension", "gift_card"),
            ("Deposit $2,000 in Bitcoin at the crypto ATM on Main St to protect your savings", "crypto_payment"),
            ("Send the funds in USDT to this wallet and your profit will be released", "crypto_payment"),
            ("E-ZPass: You have an unpaid toll of $4.15. Pay now: https://ezpass-tollpay.com/pay123", "toll_link"),
            ("Toll Services final notice, settle at tollroads-notice.top/v9 today", "toll_link"),
            ("This is Microsoft support. Please install AnyDesk so we can fix your computer", "remote_access"),
            ("Grandma please don't tell mom, I need $900 for bail today", "secrecy_money"),
            ("Your account is compromised. Move your savings to a safe account we set up for you", "safe_account"),
            ("A courier will come to your house to pick up the cash for the bail", "courier_cash"),
            ("A warrant has been issued in your name. Call now and pay the fine to avoid arrest", "arrest_threat"),
            ("Your lost iPhone is online. See location: http://view-Apple.com/23r3ew2", "lookalike_domain"),
            ("USPS: package on hold, update address at usps-redeliver.info/r1", "lookalike_domain"),
            ("Account locked. Verify at https://secure.paypalsecurity.net/login", "lookalike_domain"),
            ("Photos from Sunday are ready! https://apple.com.example.com/view", "lookalike_domain"),
        ]
        for (text, rule) in cases {
            XCTAssertTrue(fired(text).contains(rule), "\(rule) did not fire on: \(text)")
        }
    }

    func testLookAlikeLegitTextsStayQuiet() {
        let legit = [
            "Your code is 482913. Never share this code with anyone. Chase will never call you to ask for it.",
            "Target: Thanks for your purchase! Your gift card number ending 4421 has a balance of $25.00.",
            "Happy birthday Grandma! I got you a Starbucks gift card, it's in the mail",
            "E-ZPass: Your monthly statement is ready. Sign in to the E-ZPass app to view it.",
            "Hi! You just spoke to DEEPAK. Reply Toll Free with Yes or No",
            "Don't tell mom about the surprise party Saturday!",
            "Coinbase: Your weekly price alert: Bitcoin is up 3% today.",
            "Your Amazon package was delivered by the courier at 2:14 PM.",
            "Jury duty reminder from the county court: report on Monday at 8 AM.",
            "We moved your appointment to Tuesday at 10 AM. Reply C to confirm.",
            "Your Amazon order shipped. Track it at https://www.amazon.com/progress-tracker/123",
            "USPS Informed Delivery: track at https://tools.usps.com/go/TrackConfirmAction",
            "Read our blog at startups.com and groups.google.com",
            "Apple: your receipt is at https://reportaproblem.apple.com",
            "Amazon UK: your order shipped, see https://www.amazon.co.uk/orders",
            "Chase: Never move your savings to a safe account when a caller asks. This is a scam.",
            "We will never ask you to move money to a secure account.",
            "Chase fraud alert: Never install AnyDesk or share your screen with a caller.",
            "Your toll statement is ready at https://www.sunpass.com",
            "Thanks for calling. Our toll-free support line is listed at https://example.com/help",
        ]
        for text in legit {
            XCTAssertEqual(fired(text), [], "false hold on: \(text)")
        }
    }

    func testEveryRuleHasAPlainReason() {
        for rule in ScamRules.all {
            XCTAssertFalse(rule.reason.isEmpty)
            XCTAssertFalse(rule.reason.contains("regex"))
        }
    }
}
