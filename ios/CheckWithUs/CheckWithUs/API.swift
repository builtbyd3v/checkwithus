import Foundation
import Security

/// The checkwith.us backend, as the older adult's phone sees it. Contract: web/INTEGRATION.md.
struct API {
    static let base: URL = {
        #if DEBUG
        // Simulator tests against a local mock: launch with `-apiBase http://127.0.0.1:8787/api/v1`.
        if let override = UserDefaults.standard.string(forKey: "apiBase"), let url = URL(string: override) { return url }
        #endif
        return URL(string: "https://checkwith.us/api/v1")!
    }()

    struct Failure: Error, LocalizedError {
        let message: String
        var errorDescription: String? { message }
        static let offline = Failure(message: "We could not reach your family. Check the internet and try again.")
    }

    struct Pairing: Decodable { let deviceToken: String }
    struct ServerError: Decodable { let message: String }

    struct Config: Decodable {
        struct Member: Decodable { let displayName: String }
        let protectedName: String
        let family: [Member]
    }

    struct PaymentRequest: Codable {
        struct Payee: Codable { let name: String; let kind: String }
        struct GuardScore: Codable { let score: Float; let modelVersion: String }
        let idempotencyKey: String
        let amountCents: Int
        let payee: Payee
        let category: String
        let onCall: Bool
        let `guard`: GuardScore?
        let explanation: String?
    }

    struct Payment: Decodable, Equatable {
        struct Payee: Decodable, Equatable { let name: String }
        let id: String
        /// waiting, sending, sent, blocked_by_family, blocked_no_answer, failed
        let outcome: String
        let amountCents: Int
        let payee: Payee
        let decidedByName: String?

        var isSettled: Bool { outcome != "waiting" && outcome != "sending" }
    }

    static func pair(code: String) async throws -> String {
        let body = ["code": code, "label": "iPhone"]
        let pairing: Pairing = try await send("POST", "device/pair", body: body, token: nil)
        return pairing.deviceToken
    }

    static func config(token: String) async throws -> Config {
        try await send("GET", "device/config", body: Optional<String>.none, token: token)
    }

    static func askFamily(token: String) async throws {
        struct Created: Decodable { let id: String }
        let _: Created = try await send("POST", "device/alerts", body: ["kind": "ask_family"], token: token)
    }

    static func pay(_ request: PaymentRequest, token: String) async throws -> Payment {
        try await send("POST", "payments", body: request, token: token)
    }

    static func payment(id: String, token: String) async throws -> Payment {
        try await send("GET", "payments/\(id)", body: Optional<String>.none, token: token)
    }

    private static func send<Body: Encodable, Response: Decodable>(
        _ method: String, _ path: String, body: Body?, token: String?
    ) async throws -> Response {
        var request = URLRequest(url: base.appending(path: path), timeoutInterval: 15)
        request.httpMethod = method
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let status = (response as? HTTPURLResponse)?.statusCode else { throw Failure.offline }
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ServerError.self, from: data))?.message
            throw Failure(message: message ?? "Something went wrong. Please try again.")
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}

/// Dollars typed on screen to integer cents, without floats. "84.12" -> 8412. Nil for anything else.
func cents(fromDollars text: String) -> Int? {
    let parts = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "$", with: "").split(separator: ".", omittingEmptySubsequences: false)
    // Digits only (no signs), and at most $999,999: no overflow, and under the server's $1M cap.
    guard (1...2).contains(parts.count), parts.allSatisfy({ $0.allSatisfy { ("0"..."9").contains($0) } }),
          (1...6).contains(parts[0].count), let dollars = Int(parts[0]) else { return nil }
    var c = dollars * 100
    if parts.count == 2 {
        guard (1...2).contains(parts[1].count), let fraction = Int(parts[1]) else { return nil }
        c += parts[1].count == 1 ? fraction * 10 : fraction
    }
    return c > 0 ? c : nil
}

/// "$84.12", or "$500" for whole dollars.
func dollars(_ cents: Int) -> String {
    cents % 100 == 0 ? "$\(cents / 100)" : String(format: "$%d.%02d", cents / 100, cents % 100)
}

/// The device token is a credential, so it lives in the Keychain, not UserDefaults.
enum TokenStore {
    private static let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "us.checkwith.device"]

    static func load() -> String? {
        var item: CFTypeRef?
        let q = query.merging([kSecReturnData as String: true]) { $1 }
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func save(_ token: String) {
        SecItemDelete(query as CFDictionary)
        let q = query.merging([kSecValueData as String: Data(token.utf8), kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock]) { $1 }
        SecItemAdd(q as CFDictionary, nil)
    }
}
