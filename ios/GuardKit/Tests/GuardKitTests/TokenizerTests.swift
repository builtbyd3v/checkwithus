import Foundation
import XCTest
@testable import GuardKit

final class TokenizerTests: XCTestCase {
    struct Fixture: Decodable {
        struct Case: Decodable { let text: String; let ids: [Int32] }
        let max_len: Int
        let cases: [Case]
    }

    /// Every case must match the Hugging Face ids exactly (ml/make_swift_fixture.py).
    func testMatchesHuggingFace() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "tokenizer_cases", withExtension: "json"))
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
        XCTAssertGreaterThan(fixture.cases.count, 300)
        let tok = try WordPieceTokenizer(maxLength: fixture.max_len)
        var failures: [String] = []
        for c in fixture.cases where tok.ids(c.text) != c.ids {
            failures.append(String(c.text.prefix(60)))
        }
        XCTAssertTrue(failures.isEmpty, "\(failures.count) of \(fixture.cases.count) differ, e.g. \(failures.prefix(5))")
    }

    func testEncodePadsToMaxLength() throws {
        let tok = try WordPieceTokenizer(maxLength: 128)
        let (ids, mask) = tok.encode("hello grandma")
        XCTAssertEqual(ids.count, 128)
        XCTAssertEqual(mask.count, 128)
        XCTAssertEqual(mask.reduce(0, +), Int32(tok.ids("hello grandma").count))
    }
}
