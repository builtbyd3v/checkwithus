import LocalAuthentication
import SwiftUI

/// State for the family side of the app. Everything is reloaded by polling (no push notifications yet).
@Observable final class FamilyModel {
    enum Tab: String { case holds, alerts, money, allowances, settings }

    var tokens = FamilyAuth.load()
    /// Nil until loaded; empty means this person still has to join with an invite code.
    var circles: [FamilyAPI.Circle]?
    var payments: [FamilyAPI.Payment] = []
    var alerts: [FamilyAPI.Alert] = []
    var balance: FamilyAPI.Balance?
    var allowances: [FamilyAPI.Allowance] = []
    var busy = false
    var error: String?
    /// A calm one-line answer, such as "Freeze is not available yet".
    var notice: String?
    var tab = Tab.holds
    var holdsPath: [String] = []
    var addingAllowance = false
    /// What the last freeze moved to safety, to offer it back on unfreeze.
    var frozenCents = UserDefaults.standard.integer(forKey: "frozenCents") {
        didSet { UserDefaults.standard.set(frozenCents, forKey: "frozenCents") }
    }
    @ObservationIgnored private var mock = false

    var circle: FamilyAPI.Circle? { circles?.first }
    var protectedName: String { circle?.protectedName ?? "They" }
    var held: [FamilyAPI.Payment] { payments.filter { $0.status == "held" } }
    var frozen: Bool { balance?.frozen ?? false }

    init() {
        #if DEBUG
        // Screenshots without Auth0: launch with `-familyPreview holds|detail|alerts|money|frozen|allowances|grant|settings`.
        if let preview = UserDefaults.standard.string(forKey: "familyPreview") { loadMock(preview) }
        #endif
    }

    func signIn() async {
        await run {
            self.save(try await FamilyAuth.signIn())
            await self.refresh()
        }
    }

    func signOut() {
        save(nil)
        circles = nil
        payments = []
        alerts = []
        balance = nil
        allowances = []
        holdsPath = []
    }

    func join(code: String, name: String) async {
        await run {
            try await self.authed { try await FamilyAPI.join(inviteCode: code, displayName: name, $0) }
            self.circles = nil
            await self.refresh()
        }
    }

    /// Reloads everything every 10 seconds while the family screens are open.
    func poll() async {
        while !Task.isCancelled, tokens != nil {
            await refresh()
            try? await Task.sleep(for: .seconds(10))
        }
    }

    func refresh() async {
        guard !mock else { return }
        do {
            if circles?.isEmpty ?? true { circles = try await authed(FamilyAPI.circles) }
            guard let id = circle?.circleId else { return }
            payments = try await authed(FamilyAPI.payments)
            alerts = try await authed(FamilyAPI.alerts)
            allowances = try await authed { try await FamilyAPI.allowances(id, $0) }
            // The balance asks the bank; keep the last one if the bank is slow.
            if let latest = try? await authed({ try await FamilyAPI.balance(id, $0) }) { balance = latest }
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    func decide(_ payment: FamilyAPI.Payment, approve: Bool) async {
        if approve, !(await ownerConfirms("Approve \(dollars(payment.amountCents)) to \(payment.payee.name)")) { return }
        await run {
            #if DEBUG
            if self.mock { return self.replace(payment.id) { $0.status = approve ? "approved" : "denied"; $0.decidedByName = "You" } }
            #endif
            do {
                let updated = try await self.authed { try await FamilyAPI.decide(payment.id, approve: approve, $0) }
                self.replace(payment.id) { $0 = updated }
            } catch let failure as FamilyAPI.Failure where failure.status == 409 {
                // Someone else answered first, or time ran out: show what happened.
                await self.refresh()
                throw failure
            }
        }
    }

    func freeze() async {
        await run {
            #if DEBUG
            if self.mock { self.balance?.frozen = true; self.frozenCents = self.balance?.availableCents ?? 0; return }
            #endif
            guard let id = self.circle?.circleId else { return }
            try await self.unlessMissing {
                let result = try await self.authed { try await FamilyAPI.freeze(id, $0) }
                self.frozenCents = result.movedCents
                self.balance?.frozen = result.frozen
                await self.refresh()
            }
        }
    }

    func unfreeze(cents: Int) async {
        await run {
            #if DEBUG
            if self.mock { self.balance?.frozen = false; self.frozenCents = 0; return }
            #endif
            guard let id = self.circle?.circleId else { return }
            try await self.unlessMissing {
                let result = try await self.authed { try await FamilyAPI.unfreeze(id, amountCents: cents, $0) }
                self.frozenCents = max(0, self.frozenCents - result.movedCents)
                self.balance?.frozen = result.frozen
                await self.refresh()
            }
        }
    }

    /// True when saved. Granting needs a fresh sign-in; `authed` runs it when the server asks.
    func grant(category: String, cents: Int, until: Date) async -> Bool {
        let grant = FamilyAPI.Grant(payeeId: nil, category: category, maxAmountCents: cents,
                                    expiresAt: ISO8601DateFormatter().string(from: until))
        var saved = false
        await run {
            #if DEBUG
            if self.mock {
                self.allowances.insert(.init(id: UUID().uuidString, payeeName: nil, category: category, maxAmountCents: cents, expiresAt: grant.expiresAt), at: 0)
                saved = true
                return
            }
            #endif
            guard let id = self.circle?.circleId else { return }
            try await self.authed { try await FamilyAPI.grant(id, grant, $0) }
            saved = true
            await self.refresh()
        }
        return saved
    }

    func revoke(_ allowance: FamilyAPI.Allowance) async {
        await run {
            self.allowances.removeAll { $0.id == allowance.id }
            guard !self.mock, let id = self.circle?.circleId else { return }
            try await self.authed { try await FamilyAPI.revoke(id, allowance.id, $0) }
        }
    }

    // MARK: - Plumbing

    /// Calls the API with the access token. A 401 refreshes the token once, then signs out (the sign-in screen
    /// shows). A step-up answer opens Auth0 for a fresh sign-in and retries once.
    private func authed<T>(_ call: (String) async throws -> T) async throws -> T {
        guard let current = tokens else { throw API.Failure(message: "Please sign in.") }
        do {
            return try await call(current.access)
        } catch let failure as FamilyAPI.Failure where failure.status == 401 {
            guard let renewed = await FamilyAuth.refresh(current) else { signOut(); throw failure }
            save(renewed)
            return try await call(renewed.access)
        } catch let failure as FamilyAPI.Failure where failure.code == "step_up_required" {
            save(try await FamilyAuth.signIn(fresh: true))
            return try await call(tokens!.access)
        }
    }

    /// The freeze routes are being built in parallel; until they ship the server answers 404.
    private func unlessMissing(_ work: () async throws -> Void) async throws {
        do { try await work() } catch let failure as FamilyAPI.Failure where failure.status == 404 {
            notice = "Freeze is not available yet"
        }
    }

    /// Face ID (or the passcode) before money moves, as the decision route expects.
    private func ownerConfirms(_ reason: String) async -> Bool {
        guard !mock else { return true }
        let context = LAContext()
        // ponytail: a phone with no passcode has nothing to check; the Auth0 sign-in is the only gate then.
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else { return true }
        return (try? await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)) ?? false
    }

    private func save(_ tokens: FamilyAuth.Tokens?) {
        self.tokens = tokens
        FamilyAuth.save(tokens)
    }

    private func replace(_ id: String, _ change: (inout FamilyAPI.Payment) -> Void) {
        guard let i = payments.firstIndex(where: { $0.id == id }) else { return }
        change(&payments[i])
    }

    private func run(_ work: @escaping () async throws -> Void) async {
        busy = true
        error = nil
        notice = nil
        do { try await work() } catch { self.error = error.localizedDescription }
        busy = false
    }

    #if DEBUG
    private func loadMock(_ preview: String) {
        mock = true
        tokens = .init(access: "preview", refresh: nil)
        circles = [.init(circleId: "c1", protectedName: "Rosa", yourName: "Maria")]
        let now = Date()
        let iso = { (minutes: Double) in ISO8601DateFormatter().string(from: now.addingTimeInterval(minutes * 60)) }
        let payment = { (id: String, status: String, cents: Int, payee: String, kind: String, known: Bool, category: (String, String),
                         onCall: Bool, reasons: [(String, String)], note: String?, ago: Double, by: String?) in
            FamilyAPI.Payment(
                id: id, circleId: "c1", protectedName: "Rosa", status: status, amountCents: cents,
                payee: .init(name: payee, kind: kind, known: known), category: .init(code: category.0, label: category.1),
                onCall: onCall, holdReasons: reasons.map { .init(code: $0.0, label: $0.1) }, explanation: note,
                createdAt: iso(-ago), expiresAt: iso(5 - ago), decidedByName: by, approvalsRequired: 1)
        }
        payments = [
            payment("p1", "held", 50000, "Gift card store", "merchant", false, ("gift_cards", "Gift cards"), true,
                    [("gift_card", "Gift card purchase"), ("new_payee", "Someone they have not paid before"), ("during_call", "Paid while on a phone call")],
                    "Rosa is paying $500 to Gift card store while on a phone call. Gift cards are the most common way scammers ask to be paid, because they cannot be traced or refunded.", 1, nil),
            payment("p2", "held", 32000, "City Power & Light", "biller", true, ("utilities", "Utilities"), false,
                    [("over_limit", "Over the limit you set")], nil, 2, nil),
            payment("p3", "paid", 8412, "Sunrise Grocery", "merchant", true, ("groceries", "Groceries"), false, [], nil, 90, nil),
            payment("p4", "denied", 200000, "Crypto ATM", "merchant", false, ("crypto", "Crypto"), true,
                    [("crypto", "Crypto purchase")], nil, 300, "Leo"),
            payment("p5", "expired", 25000, "Unknown person", "person", false, ("other", "Other"), false,
                    [("new_payee", "Someone they have not paid before")], nil, 1500, nil),
        ]
        alerts = [
            .init(id: "a1", protectedName: "Rosa", kind: "bank_during_call", detail: "Near Chase on University Ave", createdAt: iso(-3)),
            .init(id: "a2", protectedName: "Rosa", kind: "ask_family", detail: nil, createdAt: iso(-45)),
            .init(id: "a3", protectedName: "Rosa", kind: "some_future_kind", detail: nil, createdAt: iso(-50)),
        ]
        balance = .init(availableCents: 241_288, ledgerBalanceCents: 273_288, reservedCents: 32000, checkedAt: iso(-1), frozen: false)
        allowances = [
            .init(id: "l1", payeeName: nil, category: "utilities", maxAmountCents: 20000, expiresAt: iso(60 * 24 * 40)),
            .init(id: "l2", payeeName: "Neighborhood Pharmacy", category: nil, maxAmountCents: 15000, expiresAt: iso(60 * 24 * 12)),
        ]
        switch preview {
        case "detail": holdsPath = ["p1"]
        case "alerts": tab = .alerts
        case "money": tab = .money
        case "frozen": tab = .money; balance?.frozen = true; frozenCents = 241_288
        case "allowances": tab = .allowances
        case "grant": tab = .allowances; addingAllowance = true
        case "settings": tab = .settings
        default: break
        }
    }
    #endif
}
