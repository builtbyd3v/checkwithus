import Foundation

/// The checkwith.us family API (web/app/api/v1/family/**), called with the Auth0 access token.
enum FamilyAPI {
    /// A non-2xx answer. `code` is the server's error code, such as `step_up_required`.
    struct Failure: Error, LocalizedError {
        let status: Int
        let code: String?
        let message: String
        var errorDescription: String? { message }
    }

    struct Circle: Decodable { let circleId: String; let protectedName: String; let yourName: String }

    struct Payment: Decodable, Identifiable, Equatable {
        struct Payee: Decodable, Equatable { let name: String; let kind: String; let known: Bool }
        struct Category: Decodable, Equatable { let code: String; let label: String }
        struct Reason: Decodable, Equatable { let code: String; let label: String }
        let id: String
        let circleId: String
        let protectedName: String
        /// held, approved, paying, paid, denied, expired, failed
        var status: String
        let amountCents: Int
        let payee: Payee
        let category: Category
        let onCall: Bool
        let holdReasons: [Reason]
        let explanation: String?
        let createdAt: String?
        let expiresAt: String?
        var decidedByName: String?
        let approvalsRequired: Int?
    }

    struct Alert: Decodable, Identifiable {
        let id: String
        let protectedName: String
        let kind: String
        let detail: String?
        let createdAt: String
    }

    struct Balance: Decodable {
        let availableCents: Int
        let ledgerBalanceCents: Int
        let reservedCents: Int
        let checkedAt: String
        /// Added by the freeze work; a server without it is not frozen.
        var frozen: Bool?
    }

    struct Freeze: Decodable { let frozen: Bool; let movedCents: Int }

    struct Allowance: Decodable, Identifiable {
        let id: String
        let payeeName: String?
        let category: String?
        let maxAmountCents: Int
        let expiresAt: String
    }

    struct Grant: Encodable {
        let payeeId: String?
        let category: String?
        let maxAmountCents: Int
        let expiresAt: String
    }

    static func circles(_ token: String) async throws -> [Circle] {
        struct R: Decodable { let circles: [Circle] }
        return try await send("GET", "family/me", token: token, as: R.self).circles
    }

    static func join(inviteCode: String, displayName: String, _ token: String) async throws {
        struct R: Decodable { let circleId: String }
        _ = try await send("POST", "family/join", ["inviteCode": inviteCode, "displayName": displayName], token: token, as: R.self)
    }

    static func payments(_ token: String) async throws -> [Payment] {
        struct R: Decodable { let payments: [Payment] }
        return try await send("GET", "family/payments", token: token, as: R.self).payments
    }

    static func decide(_ id: String, approve: Bool, _ token: String) async throws -> Payment {
        try await send("POST", "family/payments/\(id)/decision", ["decision": approve ? "approve" : "deny"], token: token, as: Payment.self)
    }

    static func alerts(_ token: String) async throws -> [Alert] {
        struct R: Decodable { let alerts: [Alert] }
        return try await send("GET", "family/alerts", token: token, as: R.self).alerts
    }

    static func balance(_ circle: String, _ token: String) async throws -> Balance {
        try await send("GET", "family/circles/\(circle)/balance", token: token, as: Balance.self)
    }

    static func freeze(_ circle: String, _ token: String) async throws -> Freeze {
        try await send("POST", "family/circles/\(circle)/freeze", [String: Int](), token: token, as: Freeze.self)
    }

    static func unfreeze(_ circle: String, amountCents: Int, _ token: String) async throws -> Freeze {
        try await send("POST", "family/circles/\(circle)/unfreeze", ["amountCents": amountCents], token: token, as: Freeze.self)
    }

    static func allowances(_ circle: String, _ token: String) async throws -> [Allowance] {
        struct R: Decodable { let allowances: [Allowance] }
        return try await send("GET", "family/circles/\(circle)/allowances", token: token, as: R.self).allowances
    }

    static func grant(_ circle: String, _ grant: Grant, _ token: String) async throws {
        struct R: Decodable { let id: String }
        _ = try await send("POST", "family/circles/\(circle)/allowances", grant, token: token, as: R.self)
    }

    static func revoke(_ circle: String, _ id: String, _ token: String) async throws {
        struct R: Decodable { let revoked: Bool }
        _ = try await send("DELETE", "family/circles/\(circle)/allowances/\(id)", token: token, as: R.self)
    }

    /// Revokes the older adult's device token. Returns how many phones were unpaired.
    static func unpair(_ circle: String, _ token: String) async throws -> Int {
        struct R: Decodable { let unpaired: Int }
        return try await send("POST", "family/circles/\(circle)/unpair", [String: Int](), token: token, as: R.self).unpaired
    }

    private struct ErrorBody: Decodable { let error: String?; let message: String? }

    private static func send<R: Decodable>(_ method: String, _ path: String, _ body: (some Encodable)? = String?.none,
                                           token: String, as: R.Type) async throws -> R {
        var request = URLRequest(url: API.base.appending(path: path), timeoutInterval: 15)
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let status = (response as? HTTPURLResponse)?.statusCode else { throw API.Failure.offline }
        guard (200..<300).contains(status) else {
            let e = try? JSONDecoder().decode(ErrorBody.self, from: data)
            throw Failure(status: status, code: e?.error, message: e?.message ?? "Something went wrong. Please try again.")
        }
        return try JSONDecoder().decode(R.self, from: data)
    }
}

/// Server times are ISO 8601 with or without milliseconds.
func isoDate(_ text: String?) -> Date? {
    guard let text else { return nil }
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = f.date(from: text) { return date }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: text)
}
