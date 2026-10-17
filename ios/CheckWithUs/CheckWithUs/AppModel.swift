import ActivityKit
import CallKit
import GuardKit
import SwiftUI
import UIKit

/// Someone the older adult can pay. Names match the demo seed's known payees (web/scripts/seed-demo.ts).
struct Payee: Hashable, Identifiable {
    let name: String
    /// merchant, person or biller (web/lib/categories.ts)
    let kind: String
    let category: String
    let symbol: String
    var id: String { name }

    static let all = [
        Payee(name: "City Power & Light", kind: "biller", category: "utilities", symbol: "bolt.fill"),
        Payee(name: "Sunrise Grocery", kind: "merchant", category: "groceries", symbol: "cart.fill"),
        Payee(name: "Neighborhood Pharmacy", kind: "merchant", category: "pharmacy", symbol: "cross.case.fill"),
        Payee(name: "Gift card store", kind: "merchant", category: "gift_cards", symbol: "giftcard.fill"),
    ]
}

enum Screen: Equatable {
    case home, choosePayee, amount(Payee), confirm(Payee, cents: Int), status, asked
}

@Observable final class AppModel {
    var token = TokenStore.load()
    var config: API.Config?
    var screen = Screen.home
    var payment: API.Payment?
    var busy = false
    var error: String?

    private let calls = CXCallObserver()
    /// One key per payment attempt, reused when retrying it (web/INTEGRATION.md).
    private var attemptKey = UUID().uuidString
    private var activity: Activity<PaymentActivity>?
    private var watching = false
    private var backgroundTask = UIBackgroundTaskIdentifier.invalid
    private static let guardModel = try? Guard(scorer: NGramScorer())

    var isOnCall: Bool { calls.calls.contains { !$0.hasEnded } }

    #if DEBUG
    /// Screenshots without a server: launch with `-preview home|payees|confirm|waiting|denied`.
    init() {
        let payee = Payee.all[3]
        let held = { (outcome: String) in API.Payment(id: "preview", outcome: outcome, amountCents: 50000, payee: .init(name: payee.name), decidedByName: nil) }
        switch UserDefaults.standard.string(forKey: "preview") {
        case "home": token = "preview"; config = .init(protectedName: "Rosa", family: [])
        case "payees": token = "preview"; screen = .choosePayee
        case "confirm": token = "preview"; screen = .confirm(payee, cents: 50000)
        case "waiting": token = "preview"; payment = held("waiting"); screen = .status
        case "denied": token = "preview"; payment = held("blocked_by_family"); screen = .status
        default: break
        }
    }
    #endif

    func go(_ next: Screen) {
        error = nil
        if case .confirm = next { attemptKey = UUID().uuidString }
        screen = next
    }

    func pair(code: String) async {
        await run {
            let token = try await API.pair(code: code)
            TokenStore.save(token)
            self.token = token
            await self.loadConfig()
        }
    }

    func loadConfig() async {
        guard let token else { return }
        if let latest = try? await API.config(token: token) { config = latest }
    }

    func askFamily() async {
        guard let token else { return }
        await run {
            try await API.askFamily(token: token)
            self.go(.asked)
        }
    }

    func pay(_ payee: Payee, cents: Int) async {
        guard let token else { return }
        // ponytail: the Guard scores the payment's own words (payee + category). There is no text here to read;
        // the server treats the score as advisory and its fixed rules decide.
        let verdict = try? Self.guardModel?.check("\(payee.name) \(payee.category.replacingOccurrences(of: "_", with: " "))")
        let request = API.PaymentRequest(
            idempotencyKey: attemptKey, amountCents: cents,
            payee: .init(name: payee.name, kind: payee.kind), category: payee.category, onCall: isOnCall,
            guard: verdict.map { .init(score: $0.probability, modelVersion: "guard-ngram-1") }, explanation: nil)
        await run {
            let payment = try await API.pay(request, token: token)
            self.payment = payment
            self.go(.status)
            if !payment.isSettled {
                self.startActivity(payment)
                Task { await self.watch() }
            }
        }
    }

    /// Polls the held payment every 5 seconds until it settles. This polling is also what makes the server
    /// ask Auth0 whether the family answered the Guardian push.
    func watch() async {
        guard !watching, let token else { return }
        watching = true
        defer { watching = false; endBackgroundTask() }
        var delay: Double = 5
        while let current = payment, !current.isSettled {
            try? await Task.sleep(for: .seconds(delay))
            do {
                let latest = try await API.payment(id: current.id, token: token)
                delay = 5
                if latest != current {
                    payment = latest
                    await updateActivity(latest)
                }
            } catch {
                delay = min(delay * 2, 30)
            }
        }
    }

    /// iOS gives a backgrounded app about 30 seconds; spend them polling so the lock-screen card can update.
    func keepPollingInBackground() {
        guard watching, backgroundTask == .invalid else { return }
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in self?.endBackgroundTask() }
    }

    private func endBackgroundTask() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    private func startActivity(_ payment: API.Payment) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = PaymentActivity(amount: dollars(payment.amountCents), payee: payment.payee.name)
        activity = try? Activity.request(attributes: attributes, content: .init(state: .init(outcome: payment.outcome), staleDate: nil))
    }

    private func updateActivity(_ payment: API.Payment) async {
        guard let activity else { return }
        let content = ActivityContent(state: PaymentActivity.ContentState(outcome: payment.outcome), staleDate: nil)
        if payment.isSettled {
            await activity.end(content, dismissalPolicy: .after(.now + 15 * 60))
            self.activity = nil
        } else {
            await activity.update(content)
        }
    }

    private func run(_ work: @escaping () async throws -> Void) async {
        busy = true
        error = nil
        do { try await work() } catch { self.error = error.localizedDescription }
        busy = false
    }
}
