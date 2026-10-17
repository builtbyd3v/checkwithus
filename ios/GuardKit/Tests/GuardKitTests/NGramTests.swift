import Foundation
import XCTest
@testable import GuardKit

final class NGramTests: XCTestCase {
    struct Case: Decodable { let text: String; let n: Int; let p: Float }

    /// Swift features and scores must match ml/train_ngram.py on every fixture text.
    func testMatchesPython() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "ngram_cases", withExtension: "json"))
        let cases = try JSONDecoder().decode([Case].self, from: Data(contentsOf: url))
        XCTAssertGreaterThan(cases.count, 200)
        let scorer = try NGramScorer()
        var bad: [String] = []
        for c in cases {
            let p = scorer.score(c.text)
            if NGramScorer.features(c.text, bits: scorer.bits, charNs: scorer.charNs).count != c.n || abs(p - c.p) > 1e-4 {
                bad.append("\(c.text.prefix(40)) swift=\(p) python=\(c.p)")
            }
        }
        XCTAssertTrue(bad.isEmpty, "\(bad.count) of \(cases.count) differ, e.g. \(bad.prefix(3))")
    }

    func testFnv1aKnownValue() {
        // FNV-1a 32-bit of "a" is 0xE40C292C.
        XCTAssertEqual(NGramScorer.fnv1a("a"), 0xE40C292C)
    }
}
