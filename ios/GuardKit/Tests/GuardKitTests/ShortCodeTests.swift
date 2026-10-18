import XCTest
@testable import GuardKit

final class ShortCodeTests: XCTestCase {
    func testClean() {
        let cases: [(String, String)] = [
            ("abcd2345", "ABCD2345"),            // lowercase
            ("ABCD-2345", "ABCD2345"),           // pasted with dash
            (" ab cd 23 45 ", "ABCD2345"),       // pasted with spaces
            ("oOiIlL00", "00111100"),            // look-alikes
            ("ABCD-23456789", "ABCD2345"),       // 9+ characters
            ("A!B@U#C$D_2.3/4,5", "ABCD2345"),   // invalid characters, U included
            ("ABCD-234", "ABCD234"),             // 7 characters
        ]
        for (input, cleaned) in cases { XCTAssertEqual(ShortCode.clean(input), cleaned, input) }
    }

    func testSevenIsIncomplete() {
        XCTAssertNil(ShortCode.canonical("ABCD234"))
        XCTAssertEqual(ShortCode.canonical("ABCD2345"), "ABCD-2345")
    }

    func testNext() {
        XCTAssertEqual(ShortCode.next(previous: "ABC", edited: "ABCd"), "ABCD")
        XCTAssertEqual(ShortCode.next(previous: "ABCD2345", edited: "ABCD23456"), "ABCD2345")
        XCTAssertEqual(ShortCode.next(previous: "ABCD", edited: "ABCD-"), "ABCD")
        XCTAssertEqual(ShortCode.next(previous: "ABCD", edited: "ABC"), "ABC")
        XCTAssertEqual(ShortCode.next(previous: "", edited: "abcd-2345"), "ABCD2345")
        XCTAssertEqual(ShortCode.next(previous: "XY", edited: "XY wxyz 2345"), "WXYZ2345")
        XCTAssertEqual(ShortCode.next(previous: "ABCD2345", edited: "ABCD2345WXYZ-6789"), "WXYZ6789")
        XCTAssertEqual(ShortCode.next(previous: "AB", edited: "AB cd"), "ABCD")
    }
}
