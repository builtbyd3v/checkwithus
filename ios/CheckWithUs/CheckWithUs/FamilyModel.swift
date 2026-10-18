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
    /// What the last freeze moved to safety per circle, to offer it back on unfreeze. FamilyAuth.forget clears it.
    private var frozenByCircle = UserDefaults.standard.dictionary(forKey: "frozenCents") as? [String: Int] ?? [:] {
        didSet { UserDefaults.standard.set(frozenByCircle, forKey: "frozenCents") }
    }
    @ObservationIgnored private var mock = false
    /// One refresh at a time: Auth0 rotates refresh tokens, and reusing an old one revokes the sign-in.
    @ObservationIgnored private var refreshing: Task<FamilyAuth.Tokens, Error>?
    /// The access token a refresh just produced. A 401 on it signs out instead of refreshing again.
    @ObservationIgnored private var justRefreshed: String?

    var circle: FamilyAPI.Circle? { circles?.first }
    var protectedName: String { circle?.protectedName ?? "They" }
    var held: [FamilyAPI.Payment] { payments.filter { $0.status == "held" } }
    var frozen: Bool { balance?.frozen ?? false }
    var frozenCents: Int {
        get { frozenByCircle[circle?.circleId ?? ""] ?? 0 }
        set { if let id = circle?.circleId { frozenByCircle[id] = newValue } }
    }

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
        // Busy before Face ID, so a second tap cannot start a second decision.
        guard !busy else { return }
        busy = true
        error = nil
        if approve, !(await ownerConfirms("Approve \(dollars(payment.amountCents)) to \(payment.payee.name)")) { busy = false; return }
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
            guard let id = self.circle?.circleId,
                  let result = try await self.unlessMissing({ try await self.authed { try await FamilyAPI.freeze(id, $0) } }) else { return }
            self.frozenCents = result.movedCents
            self.balance?.frozen = result.frozen
            await self.refresh()
        }
    }

    func unfreeze(cents: Int) async {
        await run {
            #if DEBUG
            if self.mock { self.balance?.frozen = false; self.frozenCents = 0; return }
            #endif
            guard let id = self.circle?.circleId,
                  let result = try await self.unlessMissing({ try await self.authed { try await FamilyAPI.unfreeze(id, amountCents: cents, $0) } }) else { return }
            self.frozenCents = max(0, self.frozenCents - result.movedCents)
            self.balance?.frozen = result.frozen
            await self.refresh()
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
            if !self.mock {
                guard let id = self.circle?.circleId else { return }
                try await self.authed { try await FamilyAPI.revoke(id, allowance.id, $0) }
            }
            // Only once the server agreed, so the list never shows a revoke that did not happen.
            self.allowances.removeAll { $0.id == allowance.id }
        }
    }

    /// Revokes the older adult's phone on the server. Needs a fresh sign-in; `authed` runs it when the server asks.
    func unpair() async {
        await run {
            #if DEBUG
            if self.mock { self.notice = "\(self.protectedName)'s phone is unpaired."; return }
            #endif
            guard let id = self.circle?.circleId else { return }
            let count = try await self.authed { try await FamilyAPI.unpair(id, $0) }
            self.notice = count > 0 ? "\(self.protectedName)'s phone is unpaired." : "No phone was paired."
        }
    }

    // MARK: - Plumbing

    /// Calls the API with the access token. A 401 refreshes the token once (shared by every caller), then signs
    /// out (the sign-in screen shows). A step-up answer opens Auth0 for a fresh sign-in and retries once.
    private func authed<T>(_ call: (String) async throws -> T) async throws -> T {
        guard let current = tokens else { throw API.Failure(message: "Please sign in.") }
        do {
            let result = try await call(current.access)
            if justRefreshed == current.access { justRefreshed = nil }
            return result
        } catch let failure as FamilyAPI.Failure where failure.status == 401 {
            guard justRefreshed != current.access else { signOut(); throw failure }
            let renewed = try await renew(current)
            do { return try await call(renewed.access) } catch let again as FamilyAPI.Failure where again.status == 401 {
                signOut()
                throw again
            }
        } catch let failure as FamilyAPI.Failure where failure.code == "step_up_required" {
            save(try await FamilyAuth.signIn(fresh: true))
            return try await call(tokens!.access)
        }
    }

    /// A new access token. Concurrent 401s wait for the same refresh. Only Auth0 refusing the refresh token
    /// signs out; no connection keeps the sign-in for the next try.
    private func renew(_ stale: FamilyAuth.Tokens) async throws -> FamilyAuth.Tokens {
        if let tokens, tokens.access != stale.access { return tokens }
        let task = refreshing ?? Task { try await FamilyAuth.refresh(stale) }
        refreshing = task
        defer { if refreshing == task { refreshing = nil } }
        do {
            let renewed = try await task.value
            if tokens?.access != renewed.access {
                justRefreshed = renewed.access
                save(renewed)
            }
            return renewed
        } catch is FamilyAuth.Rejected {
            signOut()
            throw API.Failure(message: "Please sign in again.")
        } catch {
            throw API.Failure(message: "No connection. Check the internet and try again.")
        }
    }

    /// Nil, with a calm notice, when the freeze route itself answers 404 (a server without freeze yet).
    private func unlessMissing<T>(_ call: () async throws -> T) async throws -> T? {
        do { return try await call() } catch let failure as FamilyAPI.Failure where failure.status == 404 {
            notice = "Freeze is not available yet"
            return nil
        }
    }

    /// Face ID (or the passcode) before money moves, as the decision route expects.
    private func ownerConfirms(_ reason: String) async -> Bool {
        guard !mock else { return true }
        let context = LAContext()
        // No passcode means anyone holding the phone could approve, so approving is refused. Deny still works.
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else {
            error = "Set a passcode on this iPhone to approve payments."
            return false
        }
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
                    "Rosa is paying $500 to Gift card store while on a phone call. Scammers often ask to be paid with gift cards, because the money is hard to trace or get back.", 1, nil),
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
        // Freeze sweeps the spending balance to the safe account, so nothing is left to spend.
        case "frozen": tab = .money; balance = .init(availableCents: 0, ledgerBalanceCents: 0, reservedCents: 0, checkedAt: iso(-1), frozen: true); frozenByCircle = ["c1": 241_288]
        case "allowances": tab = .allowances
        case "grant": tab = .allowances; addingAllowance = true
        case "settings": tab = .settings
        default: break
        }
    }
    #endif
}
