import Foundation

/// BERT uncased WordPiece, matching the Hugging Face tokenizer the Guard was trained with.
/// Steps: clean text, space out CJK, lowercase + strip accents, split on spaces and punctuation, greedy WordPiece.
public struct WordPieceTokenizer {
    public let maxLength: Int
    private let vocab: [String: Int32]
    private let pad: Int32, unk: Int32, cls: Int32, sep: Int32
    private static let maxCharsPerWord = 100

    /// Loads the vocab bundled with GuardKit.
    public init(maxLength: Int = 128) throws {
        guard let url = Bundle.module.url(forResource: "vocab", withExtension: "txt") else {
            throw CocoaError(.fileNoSuchFile)
        }
        try self.init(vocabURL: url, maxLength: maxLength)
    }

    public init(vocabURL: URL, maxLength: Int = 128) throws {
        let lines = try String(contentsOf: vocabURL, encoding: .utf8).split(separator: "\n", omittingEmptySubsequences: false)
        var vocab = [String: Int32](minimumCapacity: lines.count)
        for (i, line) in lines.enumerated() where !line.isEmpty {
            vocab[String(line)] = Int32(i)
        }
        guard let pad = vocab["[PAD]"], let unk = vocab["[UNK]"], let cls = vocab["[CLS]"], let sep = vocab["[SEP]"] else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.vocab = vocab
        self.maxLength = maxLength
        (self.pad, self.unk, self.cls, self.sep) = (pad, unk, cls, sep)
    }

    /// Token ids with [CLS] and [SEP], truncated to maxLength. No padding.
    public func ids(_ text: String) -> [Int32] {
        var out = [cls]
        for word in basicTokens(text) {
            out += wordPiece(word)
            if out.count >= maxLength - 1 { break }
        }
        return Array(out.prefix(maxLength - 1)) + [sep]
    }

    /// Fixed-length model inputs: ids padded with [PAD], and a 1/0 attention mask.
    public func encode(_ text: String) -> (ids: [Int32], mask: [Int32]) {
        let ids = ids(text)
        let padding = maxLength - ids.count
        return (ids + Array(repeating: pad, count: padding), Array(repeating: 1, count: ids.count) + Array(repeating: 0, count: padding))
    }

    private func basicTokens(_ text: String) -> [String] {
        var cleaned = String.UnicodeScalarView()
        for s in text.unicodeScalars {
            if s.value == 0 || s.value == 0xFFFD || Self.isControl(s) { continue }
            if Self.isWhitespace(s) {
                cleaned.append(" ")
            } else if Self.isCJK(s) {
                cleaned.append(" "); cleaned.append(s); cleaned.append(" ")
            } else {
                cleaned.append(s)
            }
        }
        // Lowercase, then NFD and drop combining marks (strip accents), as BERT uncased does.
        let folded = String(cleaned).lowercased().decomposedStringWithCanonicalMapping.unicodeScalars
            .filter { $0.properties.generalCategory != .nonspacingMark }
        var tokens: [String] = []
        var current = String.UnicodeScalarView()
        func flush() {
            if !current.isEmpty { tokens.append(String(current)); current = String.UnicodeScalarView() }
        }
        for s in folded {
            if s == " " {
                flush()
            } else if Self.isPunctuation(s) {
                flush(); tokens.append(String(s))
            } else {
                current.append(s)
            }
        }
        flush()
        return tokens
    }

    private func wordPiece(_ word: String) -> [Int32] {
        let chars = Array(word.unicodeScalars)
        if chars.count > Self.maxCharsPerWord { return [unk] }
        var out: [Int32] = []
        var start = 0
        while start < chars.count {
            var end = chars.count
            var found: Int32?
            while start < end {
                var piece = String(String.UnicodeScalarView(chars[start..<end]))
                if start > 0 { piece = "##" + piece }
                if let id = vocab[piece] { found = id; break }
                end -= 1
            }
            guard let id = found else { return [unk] }
            out.append(id)
            start = end
        }
        return out
    }

    private static func isWhitespace(_ s: Unicode.Scalar) -> Bool {
        s == " " || s == "\t" || s == "\n" || s == "\r" || s.properties.generalCategory == .spaceSeparator
    }

    private static func isControl(_ s: Unicode.Scalar) -> Bool {
        if s == "\t" || s == "\n" || s == "\r" { return false }
        let c = s.properties.generalCategory
        return c == .control || c == .format
    }

    private static func isPunctuation(_ s: Unicode.Scalar) -> Bool {
        let v = s.value
        if (33...47).contains(v) || (58...64).contains(v) || (91...96).contains(v) || (123...126).contains(v) { return true }
        switch s.properties.generalCategory {
        case .connectorPunctuation, .dashPunctuation, .openPunctuation, .closePunctuation,
             .initialPunctuation, .finalPunctuation, .otherPunctuation:
            return true
        default:
            return false
        }
    }

    private static func isCJK(_ s: Unicode.Scalar) -> Bool {
        let v = s.value
        return (0x4E00...0x9FFF).contains(v) || (0x3400...0x4DBF).contains(v) || (0x20000...0x2A6DF).contains(v)
            || (0x2A700...0x2B73F).contains(v) || (0x2B740...0x2B81F).contains(v) || (0x2B820...0x2CEAF).contains(v)
            || (0xF900...0xFAFF).contains(v) || (0x2F800...0x2FA1F).contains(v)
    }
}
