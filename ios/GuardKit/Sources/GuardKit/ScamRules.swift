import Foundation

/// Fixed keyword rules that run before the model. A hit holds the text even when the model is unsure.
/// Each rule asks for an action a scammer needs (pay with gift cards, install remote access, move money),
/// not a topic, so legit texts about the same topic stay quiet. Reasons are plain words for the family.
public struct ScamRules {
    public struct Rule {
        public let id: String
        public let reason: String
        let matches: (String) -> Bool

        /// Every pattern must match (AND), and `unless` must not. Case-insensitive.
        init(_ id: String, _ reason: String, _ patterns: String..., unless: String? = nil) {
            let compile = { try! NSRegularExpression(pattern: $0, options: [.caseInsensitive, .dotMatchesLineSeparators]) }
            let regexes = patterns.map(compile), veto = unless.map(compile)
            self.init(id, reason) { text in
                let range = NSRange(text.startIndex..., in: text)
                return regexes.allSatisfy { $0.firstMatch(in: text, range: range) != nil }
                    && veto?.firstMatch(in: text, range: range) == nil
            }
        }

        init(_ id: String, _ reason: String, matches: @escaping (String) -> Bool) {
            self.id = id
            self.reason = reason
            self.matches = matches
        }
    }

    /// Brands scammers copy in links. A domain is a lookalike when its name part (before the last dot)
    /// is not the brand itself but carries it: "usps-redeliver.info", "view-apple.com", "paypalsecurity.net",
    /// or when a brand sits in front of someone else's name: "apple.com.example.com".
    static let brands = ["apple", "icloud", "amazon", "usps", "ups", "fedex", "dhl", "chase", "wellsfargo", "bankofamerica",
                         "citi", "paypal", "venmo", "zelle", "netflix", "irs", "ssa", "medicare", "ezpass", "sunpass",
                         "coinbase", "microsoft", "walmart", "costco", "att", "verizon", "tmobile", "geico"]
    private static let host = try! NSRegularExpression(pattern: #"\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[/\s?#:]|$)"#, options: [.caseInsensitive])

    static func lookalikeDomain(_ text: String) -> Bool {
        let range = NSRange(text.startIndex..., in: text)
        for m in host.matches(in: text, range: range) {
            guard let r = Range(m.range(at: 1), in: text) else { continue }
            let labels = text[r].lowercased().split(separator: ".")
            guard labels.count >= 2 else { continue }
            // "amazon.co.uk": the name is before the two-part country suffix.
            let suffix = labels.count >= 3 && labels.last!.count == 2 && ["co", "com", "org", "net", "gov", "ac"].contains(labels[labels.count - 2])
            let n = labels.count - (suffix ? 3 : 2)
            if brands.contains(String(labels[n])) { continue }
            // Short brands ("ups", "att") must be a whole hyphen part, so "startups" stays quiet.
            if labels[...n].contains(where: { label in
                let parts = label.split(separator: "-").map(String.init)
                return brands.contains { b in parts.contains(b) || (b.count >= 5 && label.contains(b)) }
            }) { return true }
        }
        return false
    }

    private static let card = #"gift ?cards?"#
    private static let link = #"(https?://|www\.|\b[a-z0-9-]+\.(com|net|org|info|xyz|top|us|co|vip|live|io)\b)"#
    /// A warning that tells you NOT to do the thing ("Never move your savings", "Do not install AnyDesk").
    private static let never = #"\b(never|don'?t|do not|won'?t|will not|should not)\s+(ever\s+)?(ask (you )?to\s+)?"#

    public static let all: [Rule] = [
        Rule("gift_card", "Asks you to pay with gift cards or share gift card codes",
             #"\b(send|text|give|read|share|email)\b.{0,60}\b(codes?|pictures?|photos?)\b|\bpay\b.{0,40}"# + card
                 + #"|\b(buy|purchase|pick up|get)\b.{0,30}"# + card + #".{0,80}\b(fee|fine|bail|codes?|text me|send me|pay)\b"#,
             card),
        Rule("crypto_payment", "Asks you to send cryptocurrency",
             #"\b(send|deposit|transfer|pay|buy|put)\b.{0,40}\b(bitcoin|btc|usdt|tether|crypto|ethereum)\b|\b(bitcoin|crypto) (atm|kiosk|machine)\b"#,
             unless: never + #"(send|deposit|transfer|pay|buy|put)\b"#),
        // Investment scams (pig butchering): the fee to "withdraw" fake profit. No rule for the opener (it reads like a
        // real wrong number) or the pitch: pitch rules caught 0 and 1 of 30 blind-written texts (ml/data/DECISIONS.md 30).
        Rule("withdraw_fee", "Asks you to pay a fee or deposit before you can get your money out",
             #"\b(pay|deposit|top ?up|send)\b.{0,60}\b(to|before you can|so you can)\s+(withdraw|unlock|release|unfreeze|access|claim)\b"#
                 + #"|\b(withdraw\w*|unlock|release)\b.{0,60}\b(must|need to|needs?|required|first)\b.{0,40}\b(fee|tax|deposit|pay)\b"#
                 + #"|\b(before|to)\s+(withdraw\w*|unlock|release)\b.{0,60}\b(fee|deposit)\b"#,
             unless: never + #"(pay|send|deposit|ask)\b"#),
        Rule("toll_link", "Unpaid toll notice with a payment link",
             #"\btolls?\b(?![- ]?free).{0,120}"# + link,
             #"\b(unpaid|overdue|due|pay|payment|balance|outstanding|fee|fine|penalty|settle|final notice)\b"#),
        Rule("remote_access", "Asks you to install remote-access software",
             #"\b(anydesk|teamviewer|ultraviewer|quick ?support|logmein|remote (access|desktop|control))\b"#,
             unless: never + #"(install|download|give|share|let|allow|use)\b"#),
        Rule("secrecy_money", "Asks you to keep a money request secret",
             #"\b(don'?t|do not|never) (tell|call|let) (anyone|mom|dad|your (family|kids|son|daughter|bank))\b|\bkeep (this|it) (a )?(secret|confidential|between us)\b|\bgag order\b"#,
             #"\b(send|money|cash|wire|bail|pay|lawyer|gift ?cards?)\b|\$\d"#),
        Rule("safe_account", "Asks you to move money to a 'safe' account",
             #"\b(safe|secure|protected) account\b|\bmove (your )?(money|funds|savings)\b"#,
             unless: never + #"(move|transfer|send|put)\b"#),
        Rule("courier_cash", "Someone will collect cash, or wants a wire for bail or a fine",
             #"\b(courier|driver|agent|someone)\b.{0,40}\b(pick ?up|collect)\b.{0,40}\b(cash|money|payment|card)\b|\b(wire|western union|moneygram)\b.{0,60}\b(bail|lawyer|fine|arrest|jail)\b"#),
        Rule("arrest_threat", "Threatens arrest or legal action to get a payment",
             #"\b(warrant|arrest|lawsuit|legal action|sheriff|marshal)\b.{0,80}\b(pay|fee|fine|settle)\b|\b(pay|settle)\b.{0,60}\b(avoid|or face)\b.{0,20}\b(arrest|legal action|jail)\b"#),
        Rule("lookalike_domain", "Link to a fake look-alike website (a real company name inside a different web address)",
             matches: lookalikeDomain),
    ]

    public init() {}

    public func hits(_ text: String) -> [Rule] {
        Self.all.filter { $0.matches(text) }
    }
}
