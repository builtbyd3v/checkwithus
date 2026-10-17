import Foundation

/// The scam-number list the app writes and the Call Directory extension reads, through the App Group.
nonisolated enum ScamNumbers {
    static let appGroup = "group.com.devgiribharatgirigoswami.CheckWithUs"
    static let extensionID = "com.devgiribharatgirigoswami.CheckWithUs.CallDirectory"

    static var fileURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?.appending(path: "scam-numbers.json")
    }

    /// Numbers with country code (13525550123), sorted and unique, as CallKit requires.
    static func read() -> [Int64] {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([Int64].self, from: data)) ?? []
    }

    static func write(_ numbers: [String]) throws {
        guard let url = fileURL else { throw CocoaError(.fileNoSuchFile) }
        let parsed = Set(numbers.compactMap(parse)).sorted()
        try JSONEncoder().encode(parsed).write(to: url, options: .atomic)
    }

    /// "+1 (352) 555-0123" or "352-555-0123" -> 13525550123. US numbers get the 1 added.
    static func parse(_ text: String) -> Int64? {
        let digits = text.filter(\.isNumber)
        let full = digits.count == 10 ? "1" + digits : digits
        return (11...15).contains(full.count) ? Int64(full) : nil
    }
}
