import XCTest
@testable import GuardKit

final class GuardTests: XCTestCase {
    struct Fixed: ScamScorer {
        let p: Float
        let threshold: Float = 0.5
        func score(_ text: String) throws -> Float { p }
    }

    func testScoreAtThresholdHolds() throws {
        let v = try Guard(scorer: Fixed(p: 0.5)).check("hello")
        XCTAssertTrue(v.isScam)
        XCTAssertEqual(v.reasons.count, 1)
    }

    func testScoreBelowThresholdAllows() throws {
        let v = try Guard(scorer: Fixed(p: 0.49)).check("See you at dinner Sunday")
        XCTAssertFalse(v.isScam)
        XCTAssertEqual(v.reasons, [])
    }

    func testRuleHoldsWhenModelIsUnsure() throws {
        let v = try Guard(scorer: Fixed(p: 0.01)).check("Please install AnyDesk so we can fix your computer")
        XCTAssertTrue(v.isScam)
        XCTAssertEqual(v.reasons, ["Asks you to install remote-access software"])
    }

    func testNaNScoreAllows() throws {
        // Fail open: a broken score must not junk the text.
        XCTAssertFalse(try Guard(scorer: Fixed(p: .nan)).check("hello").isScam)
    }

    func testRealModelSplitsAScamFromALegitText() throws {
        let g = Guard(scorer: try NGramScorer())
        XCTAssertTrue(try g.check("USPS: your package is on hold. Pay the $1.99 redelivery fee at usps-redeliver.info/r1").isScam)
        XCTAssertFalse(try g.check("Hi Grandma, see you at dinner on Sunday. Love you!").isScam)
    }
}
