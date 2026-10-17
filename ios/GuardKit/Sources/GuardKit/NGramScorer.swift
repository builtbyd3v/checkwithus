import Foundation

/// Tiny scam scorer for the Message Filter: hashed character and word n-grams, logistic regression.
/// About 1 MB of weights, memory-mapped, so it fits the extension's ~25-30 MB limit (DistilBERT does not).
/// Features must match ml/train_ngram.py exactly; NGramTests checks this against Python scores.
public struct NGramScorer: ScamScorer {
    public let threshold: Float
    let bits: Int
    let charNs: [Int]
    private let bias: Float
    private let weights: Data

    private struct Meta: Decodable { let bits: Int; let char_ns: [Int]; let bias: Float; let threshold: Float }

    /// Loads guard_ngram.bin and guard_ngram.json bundled with GuardKit.
    public init() throws {
        guard let bin = Bundle.module.url(forResource: "guard_ngram", withExtension: "bin"),
              let json = Bundle.module.url(forResource: "guard_ngram", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        let meta = try JSONDecoder().decode(Meta.self, from: Data(contentsOf: json))
        weights = try Data(contentsOf: bin, options: .alwaysMapped)  // clean mapped pages: cheap against the memory limit
        guard weights.count == (1 << meta.bits) * 4 else { throw CocoaError(.fileReadCorruptFile) }
        (bits, charNs, bias, threshold) = (meta.bits, meta.char_ns, meta.bias, meta.threshold)
    }

    public func score(_ text: String) -> Float {
        let ids = Self.features(text, bits: bits, charNs: charNs)
        var sum: Float = 0
        weights.withUnsafeBytes { raw in
            for id in ids {
                sum += Float(bitPattern: UInt32(littleEndian: raw.load(fromByteOffset: Int(id) * 4, as: UInt32.self)))
            }
        }
        let z = bias + (ids.isEmpty ? 0 : sum / Float(ids.count).squareRoot())
        return 1 / (1 + exp(-z))
    }

    /// Lowercase, digits to 0, collapse whitespace; then char 3-5-grams on " text ", words, and word pairs.
    static func features(_ text: String, bits: Int, charNs: [Int]) -> Set<UInt32> {
        var s = String.UnicodeScalarView()
        var lastWasSpace = true  // also strips leading whitespace
        for u in text.lowercased().unicodeScalars {
            if u.properties.isWhitespace {
                if !lastWasSpace { s.append(" ") }
                lastWasSpace = true
            } else {
                s.append(("0"..."9").contains(u) ? "0" : u)
                lastWasSpace = false
            }
        }
        if s.last == " " { s.removeLast() }
        let norm = String(s)
        let mask = UInt32((1 << bits) - 1)
        var out = Set<UInt32>()
        let padded = Array((" " + norm + " ").unicodeScalars)
        for n in charNs where padded.count >= n {
            for i in 0...(padded.count - n) {
                out.insert(fnv1a("c:" + String(String.UnicodeScalarView(padded[i..<(i + n)]))) & mask)
            }
        }
        let words = norm.isEmpty ? [] : norm.split(separator: " ", omittingEmptySubsequences: false).map(String.init)
        for w in words { out.insert(fnv1a("w:" + w) & mask) }
        for (a, b) in zip(words, words.dropFirst()) { out.insert(fnv1a("b:" + a + " " + b) & mask) }
        return out
    }

    static func fnv1a(_ s: String) -> UInt32 {
        var h: UInt32 = 0x811C9DC5
        for b in s.utf8 { h = (h ^ UInt32(b)) &* 0x01000193 }
        return h
    }
}
