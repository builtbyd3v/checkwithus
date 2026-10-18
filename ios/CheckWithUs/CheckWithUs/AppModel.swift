import ActivityKit
import CallKit
import GuardKit
import SwiftUI
import UIKit
import os

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
    /// The older adult's Settings sheet, opened from the gear on Home.
    var settingsOpen = false

    private let calls = CXCallObserver()
    /// One request per payment attempt, resent unchanged when retrying it, so the idempotency key always
    /// matches the same body (web/INTEGRATION.md). Saved until the server answers, so a restart after a lost
    /// response resends the same key instead of paying twice.
    @ObservationIgnored private var attempt = UserDefaults.standard.data(forKey: AppModel.attemptKey)
        .flatMap { try? JSONDecoder().decode(API.PaymentRequest.self, from: $0) } {
        didSet { UserDefaults.standard.set(attempt.flatMap { try? JSONEncoder().encode($0) }, forKey: Self.attemptKey) }
    }
    private static let attemptKey = "paymentAttempt"
    /// The held payment survives an app restart, so polling and the lock-screen card pick up again.
    private static let watchedKey = "watchedPaymentID"
    private var activity: Activity<PaymentActivity>?
    private var watching = false
    private var backgroundTask = UIBackgroundTaskIdentifier.invalid
    private static let guardModel = try? Guard(scorer: NGramScorer())
    private static let log = Logger(subsystem: "us.checkwith.app", category: "App")

    var isOnCall: Bool { calls.calls.contains { !$0.hasEnded } }

    #if DEBUG
    /// Screenshots without a server: launch with `-preview home|settings|payees|confirm|waiting|denied|asked`.
    init() {
        let payee = Payee.all[3]
        let held = { (outcome: String) in API.Payment(id: "preview", outcome: outcome, amountCents: 50000, payee: .init(name: payee.name), decidedByName: nil) }
        switch UserDefaults.standard.string(forKey: "preview") {
        case "home": token = "preview"; config = .init(protectedName: "Sam", family: [])
        case "settings": token = "preview"; config = .init(protectedName: "Sam", family: []); settingsOpen = true
        case "asked": token = "preview"; screen = .asked
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
        // Confirming the same payee and amount again is a retry of the unanswered attempt, not a new payment.
        if case let .confirm(payee, cents) = next, attempt?.payee.name != payee.name || attempt?.amountCents != cents {
            attempt = nil
        }
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

    /// The family unpaired this phone (a 401 from a device route): forget the token and any held payment, and
    /// go back to the first screen. Only the family can do this; the older adult has no way out on the phone.
    func forget() {
        #if DEBUG
        // -preview screenshots use a fake token the server answers with 401.
        if UserDefaults.standard.string(forKey: "preview") != nil { return }
        #endif
        TokenStore.delete(service: "us.checkwith.device")
        token = nil
        config = nil
        payment = nil
        attempt = nil
        screen = .home
        settingsOpen = false
        UserDefaults.standard.removeObject(forKey: Self.watchedKey)
        UserDefaults.standard.set("", forKey: "role")
        activity = nil
        Task { for old in Activity<PaymentActivity>.activities { await old.end(nil, dismissalPolicy: .immediate) } }
    }

    /// The Call Directory extension is off until someone turns it on in Settings.
    var callLabelsOff = false

    /// Writes the scam-number list for the Call Directory extension and asks iOS to reload it.
    /// ponytail: scam-numbers.json holds fictional 555-01xx numbers; the demo phone's number goes in the
    /// gitignored scam-numbers.local.json. A real feed (for example FTC complaint data) would replace both.
    func installScamNumbers() async {
        let lists = ["scam-numbers", "scam-numbers.local"].compactMap { Bundle.main.url(forResource: $0, withExtension: "json") }
        let numbers = lists.flatMap { (try? JSONDecoder().decode([String].self, from: Data(contentsOf: $0))) ?? [] }
        let directory = CXCallDirectoryManager.sharedInstance
        do {
            try ScamNumbers.write(numbers)
            callLabelsOff = try await directory.enabledStatusForExtension(withIdentifier: ScamNumbers.extensionID) != .enabled
            if !callLabelsOff { try await directory.reloadExtension(withIdentifier: ScamNumbers.extensionID) }
        } catch {
            // Disabled, not yet registered, or unsupported: offer the Settings link rather than hide the problem.
            callLabelsOff = true
            Self.log.error("Call Directory: \(String(describing: error), privacy: .public)")
        }
    }

    func openCallSettings() {
        CXCallDirectoryManager.sharedInstance.openSettings { _ in }
    }

    func loadConfig() async {
        guard let token else { return }
        do { config = try await API.config(token: token) } catch is API.Unpaired { forget() } catch {}
    }

    /// Who is in the family, for Settings. Throws in plain words; a revoked phone goes back to the first screen.
    func family() async throws -> [API.FamilyMember] {
        #if DEBUG
        if UserDefaults.standard.string(forKey: "preview") != nil {
            return [.init(displayName: "Jordan", role: "approver"), .init(displayName: "Lee", role: "viewer")]
        }
        #endif
        guard let token else { throw API.Unpaired() }
        do { return try await API.family(token: token) } catch is API.Unpaired { forget(); throw API.Unpaired() }
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
        // One held payment at a time: only the watched payment is polled, and polling is what hears the family.
        if let held = payment, !held.isSettled { go(.status); return }
        // A call that started since the first try must reach the server. A duplicate this causes is held for the
        // family, while a stale "not on a call" could skip them.
        if attempt?.onCall == false, isOnCall { attempt = nil }
        let onCall = isOnCall
        await run {
            if self.attempt == nil {
                // ponytail: the Guard scores the payment's own words (payee + category). There is no text here to
                // read; the server treats the score as advisory and its fixed rules decide.
                let verdict = try? Self.guardModel?.check("\(payee.name) \(payee.category.replacingOccurrences(of: "_", with: " "))")
                let explanation = await Explainer.explain(.init(
                    name: self.config?.protectedName ?? "They", amount: dollars(cents), payee: payee.name,
                    category: payee.category, onCall: onCall))
                self.attempt = API.PaymentRequest(
                    idempotencyKey: UUID().uuidString, amountCents: cents,
                    payee: .init(name: payee.name, kind: payee.kind), category: payee.category, onCall: onCall,
                    guard: verdict.map { .init(score: $0.probability, modelVersion: "guard-ngram-1") }, explanation: explanation)
            }
            guard let request = self.attempt else { return }
            let payment = try await API.pay(request, token: token)
            self.attempt = nil
            self.payment = payment
            self.go(.status)
            if !payment.isSettled {
                UserDefaults.standard.set(payment.id, forKey: Self.watchedKey)
                await self.startActivity(payment)
                Task { await self.watch() }
            }
        }
    }

    /// After a restart: reload the held payment and its lock-screen card, then keep polling.
    func resume() async {
        guard payment == nil, let token, let id = UserDefaults.standard.string(forKey: Self.watchedKey) else { return }
        let latest: API.Payment
        do { latest = try await API.payment(id: id, token: token) } catch { if error is API.Unpaired { forget() }; return }
        payment = latest
        activity = Activity<PaymentActivity>.activities.first
        await updateActivity(latest)
        if latest.isSettled { UserDefaults.standard.removeObject(forKey: Self.watchedKey) } else { await watch() }
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
                // A newer payment may have replaced this one while the request was in flight.
                guard payment?.id == latest.id, latest != payment else { continue }
                payment = latest
                await updateActivity(latest)
                if latest.isSettled { UserDefaults.standard.removeObject(forKey: Self.watchedKey) }
            } catch is API.Unpaired {
                forget()
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

    private func startActivity(_ payment: API.Payment) async {
        // One card at a time: a new held payment replaces the previous one's card.
        for old in Activity<PaymentActivity>.activities { await old.end(nil, dismissalPolicy: .immediate) }
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
        do { try await work() } catch is API.Unpaired { forget() } catch { self.error = error.localizedDescription }
        busy = false
    }
}
