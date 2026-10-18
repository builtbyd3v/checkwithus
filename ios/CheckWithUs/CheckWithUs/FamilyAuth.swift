import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

/// Family sign-in: Auth0 Universal Login in a system web sheet, Authorization Code + PKCE, no client secret.
/// The access token is for the checkwith.us API (web/lib/auth/family.ts checks issuer and audience).
enum FamilyAuth {
    /// Public values: the Auth0 Native app "checkwith.us", plus the tenant and API from web/.env.local.
    /// The Native app has no client secret; never put the web app's secret here.
    static let domain = "dev-smnscbt7vw5vy8bl.us.auth0.com"
    static let clientID = "GTknuXEohQaPK6TzgzEdJoWozbxgQUDh"
    static let audience = "https://api.checkwith.us/"
    static let redirectURI = "us.checkwith.app://callback"

    struct Tokens: Codable {
        let access: String
        let refresh: String?
        /// Auth0 ID token. Its auth_time proves a fresh sign-in to the server (web/lib/auth/family.ts).
        var id: String? = nil
    }

    private static let service = "us.checkwith.family"

    static func load() -> Tokens? {
        TokenStore.load(service: service).flatMap { try? JSONDecoder().decode(Tokens.self, from: Data($0.utf8)) }
    }

    static func save(_ tokens: Tokens?) {
        guard let tokens, let data = try? JSONEncoder().encode(tokens) else { return TokenStore.delete(service: service) }
        // Never restored to another phone from a backup.
        TokenStore.save(String(decoding: data, as: UTF8.self), service: service, accessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
    }

    /// Forgets the family sign-in and anything cached for it. Runs on every role change, so the older adult
    /// cannot be talked into "I'm family" and approve with only the phone passcode.
    static func forget() {
        save(nil)
        UserDefaults.standard.removeObject(forKey: "frozenCents")
    }

    /// Auth0 refused the refresh token (`invalid_grant`): the person has to sign in again.
    struct Rejected: Error {}

    /// Opens Auth0's login page. `fresh` asks Auth0 to make the person sign in again (step-up, max_age=0).
    static func signIn(fresh: Bool = false) async throws -> Tokens {
        let verifier = randomString()
        let state = randomString()
        let challenge = base64url(Data(SHA256.hash(data: Data(verifier.utf8))))
        var url = URLComponents(string: "https://\(domain)/authorize")!
        url.queryItems = [
            .init(name: "response_type", value: "code"),
            .init(name: "client_id", value: clientID),
            .init(name: "redirect_uri", value: redirectURI),
            .init(name: "scope", value: "openid profile email offline_access"),
            .init(name: "audience", value: audience),
            .init(name: "code_challenge", value: challenge),
            .init(name: "code_challenge_method", value: "S256"),
            .init(name: "state", value: state),
        ] + (fresh ? [.init(name: "max_age", value: "0")] : [])

        let callback = try await WebSheet.open(url.url!)
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let value = { (name: String) in items.first { $0.name == name }?.value }
        guard let code = value("code") else {
            throw API.Failure(message: value("error_description") ?? "Sign-in was cancelled.")
        }
        guard value("state") == state else { throw API.Failure(message: "Sign-in did not match. Please try again.") }
        return try await token([
            "grant_type": "authorization_code", "client_id": clientID, "code": code,
            "code_verifier": verifier, "redirect_uri": redirectURI,
        ], keeping: nil)
    }

    /// A new access token from the refresh token. Throws Rejected when Auth0 says no, and other errors when
    /// Auth0 could not be reached (then keep the sign-in and try later).
    static func refresh(_ tokens: Tokens) async throws -> Tokens {
        guard let refresh = tokens.refresh else { throw Rejected() }
        return try await token(["grant_type": "refresh_token", "client_id": clientID, "refresh_token": refresh],
                               keeping: tokens)
    }

    private static func token(_ fields: [String: String], keeping old: Tokens?) async throws -> Tokens {
        struct Response: Decodable { let access_token: String; let refresh_token: String?; let id_token: String? }
        struct ErrorBody: Decodable { let error: String }
        var request = URLRequest(url: URL(string: "https://\(domain)/oauth/token")!, timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(fields)
        guard let (data, response) = try? await URLSession.shared.data(for: request) else { throw API.Failure.offline }
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              let body = try? JSONDecoder().decode(Response.self, from: data) else {
            if (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error == "invalid_grant" { throw Rejected() }
            throw API.Failure(message: "Sign-in failed. Please try again.")
        }
        // Auth0 may rotate the refresh token; keep the old one when it does not send a new one. The ID token
        // comes only from a real sign-in: a refresh must never look like a fresh sign-in to the server.
        return Tokens(access: body.access_token, refresh: body.refresh_token ?? old?.refresh, id: old == nil ? body.id_token : old?.id)
    }

    private static func randomString() -> String {
        base64url(Data((0..<32).map { _ in UInt8.random(in: .min ... .max) }))
    }

    private static func base64url(_ data: Data) -> String {
        data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}

/// ASWebAuthenticationSession as one async call.
private final class WebSheet: NSObject, ASWebAuthenticationPresentationContextProviding {
    /// Held until the sheet finishes: nothing else keeps the session or its anchor provider alive.
    private static var current: (WebSheet, ASWebAuthenticationSession)?

    static func open(_ url: URL) async throws -> URL {
        let sheet = WebSheet()
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callback: .customScheme("us.checkwith.app")) { url, error in
                current = nil
                if let url { continuation.resume(returning: url) } else {
                    continuation.resume(throwing: API.Failure(message: error == nil ? "Sign-in failed." : "Sign-in was cancelled."))
                }
            }
            session.presentationContextProvider = sheet
            // No shared Safari cookies: the login is only for this app.
            session.prefersEphemeralWebBrowserSession = true
            current = (sheet, session)
            if !session.start() {
                current = nil
                continuation.resume(throwing: API.Failure(message: "Sign-in could not open. Please try again."))
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first!
        return scene.keyWindow ?? ASPresentationAnchor(windowScene: scene)
    }
}
