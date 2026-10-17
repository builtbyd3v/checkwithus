import Foundation
import FoundationModels
import os

/// A short note for the family on why a payment looks risky. Code picks the true facts; Apple's on-device
/// model only rewrites them into a calm note, because left to explain on its own it invents details
/// ("the caller asked for gift cards" when there was no call). It never decides anything: the server's
/// fixed rules do (hard rule 1), and it runs on the phone, so only the note leaves it (hard rule 3).
enum Explainer {
    struct Facts {
        let name: String
        let amount: String
        let payee: String
        let category: String
        let onCall: Bool

        /// Each risky fact, paired with a word the rewrite must keep.
        var risks: [(sentence: String, keyword: String)] {
            var out: [(String, String)] = []
            switch category {
            case "gift_cards": out.append(("Gift cards are the most common way scammers ask to be paid, because they cannot be traced or refunded.", "gift card"))
            case "crypto": out.append(("Crypto payments cannot be reversed, and scammers often ask for them.", "crypto"))
            case "wire_transfer": out.append(("Wire transfers are hard to reverse, and scammers often ask for them.", "wire"))
            default: break
            }
            if onCall { out.append(("\(name) started this payment during a phone call. Scammers often stay on the line to pressure people while they pay.", "call")) }
            return out
        }
    }

    private static let log = Logger(subsystem: "us.checkwith.app", category: "Explainer")
    /// The default guardrails refuse anything about scams, which is the whole topic here. This mode lets the
    /// model rewrite text about it; a refusal or a dropped fact falls back to the plain facts.
    private static let model = SystemLanguageModel(guardrails: .permissiveContentTransformations)

    /// Nil when nothing looks risky on the phone, so ordinary payments go out with no delay.
    static func explain(_ facts: Facts) async -> String? {
        let risks = facts.risks
        guard !risks.isEmpty else { return nil }
        let plain = (["\(facts.name) is paying \(facts.amount) to \(facts.payee)."] + risks.map(\.sentence)).joined(separator: " ")
        guard case .available = model.availability else {
            log.notice("Explainer: model unavailable: \(String(describing: model.availability), privacy: .public)")
            return plain
        }
        let start = Date()
        // ponytail: 5 s cap. A slow model must never hold up the payment request.
        let note = await withTaskGroup(of: String?.self) { group in
            group.addTask {
                do { return try await rewrite(plain) } catch {
                    log.error("Explainer: \(String(describing: error), privacy: .public)")
                    return nil
                }
            }
            group.addTask { try? await Task.sleep(for: .seconds(5)); return nil }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
        let kept = note.map { n in risks.allSatisfy { n.localizedCaseInsensitiveContains($0.keyword) } } ?? false
        log.notice("Explainer: \(kept ? "model note" : "plain facts", privacy: .public) in \(Date().timeIntervalSince(start), format: .fixed(precision: 2), privacy: .public) s")
        return kept ? note : plain
    }

    private static func rewrite(_ facts: String) async throws -> String {
        let session = LanguageModelSession(model: model, instructions: """
            Rewrite the facts below as a short, calm note to a family member, in two sentences at most. \
            Keep every fact. Add nothing that is not in the facts. Do not give advice. \
            Write only the note itself: no greeting, no sign-off, no placeholders.
            """)
        let text = try await session.respond(to: facts).content.trimmingCharacters(in: .whitespacesAndNewlines)
        let refusal = ["I can't", "I cannot", "I'm sorry", "I am sorry", "I'm unable", "["].contains { text.localizedCaseInsensitiveContains($0) }
        guard !refusal, (20...500).contains(text.count) else { throw CocoaError(.userCancelled) }
        return text
    }
}
