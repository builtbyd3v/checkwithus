/// Family codes as people type them. Mirrors web/lib/short-code.ts, which mirrors the server's
/// normalizeShortCode (web/lib/auth/tokens.ts). The server stays the authority.
public enum ShortCode {
    public static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
    public static let length = 8

    /// Uppercase, look-alikes mapped (O to 0, I and L to 1), everything outside the alphabet dropped.
    static func codeChars(_ input: String) -> [Character] {
        input.uppercased().compactMap { c -> Character? in
            let mapped: Character = c == "O" ? "0" : c == "I" || c == "L" ? "1" : c
            return alphabet.contains(mapped) ? mapped : nil
        }
    }

    /// Whatever was typed or pasted, as at most 8 code characters, no dash.
    public static func clean(_ input: String) -> String {
        String(codeChars(input).prefix(length))
    }

    /// The field's next value after an edit. A full code pasted onto a partly or fully filled field
    /// replaces it; anything else keeps the first 8.
    public static func next(previous: String, edited: String) -> String {
        let all = codeChars(edited)
        let added = all.starts(with: previous) ? Array(all.dropFirst(previous.count)) : []
        return String((all.count > length && added.count >= length ? added : all).prefix(length))
    }

    /// XXXX-XXXX once all 8 are in, else nil.
    public static func canonical(_ cleaned: String) -> String? {
        cleaned.count == length ? "\(cleaned.prefix(4))-\(cleaned.suffix(4))" : nil
    }
}
