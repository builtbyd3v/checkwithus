import SwiftUI

/// The family side: standard iOS screens, plain words. Polls the server while open.
struct FamilyRootView: View {
    @State private var model = FamilyModel()

    var body: some View {
        Group {
            if model.tokens == nil {
                FamilySignInView()
            } else if model.circles?.isEmpty == true {
                JoinCircleView()
            } else {
                FamilyTabs()
            }
        }
        .environment(model)
        // Keyed on signed in or not, so a token refresh does not restart polling.
        .task(id: model.tokens == nil) { await model.poll() }
    }
}

struct FamilyTabs: View {
    @Environment(FamilyModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.tab) {
            Tab("Approvals", systemImage: "hand.raised.fill", value: .holds) { HoldsView() }
                .badge(model.held.count)
            Tab("Alerts", systemImage: "bell.fill", value: .alerts) { AlertsView() }
            Tab("Money", systemImage: "banknote.fill", value: .money) { MoneyView() }
            Tab("Allowances", systemImage: "checkmark.seal.fill", value: FamilyModel.Tab.allowances) { AllowancesView() }
            Tab("Settings", systemImage: "gearshape.fill", value: .settings) { FamilySettingsView() }
        }
    }
}

// MARK: - Sign in and join

struct FamilySignInView: View {
    @Environment(FamilyModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        // Scrolls, so very large text is never cut off; centered while it fits.
        ScrollView {
            VStack(spacing: 20) {
                Image(systemName: "person.2.badge.key.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.tint)
                    .accessibilityHidden(true)
                Text("Sign in to help your family").font(.title.bold())
                Text("You will approve payments, see alerts and freeze money if something looks wrong.")
                    .foregroundStyle(.secondary)
                if let error = model.error { Text(error).foregroundStyle(Color.errorText) }
                // Very large text: only Sign in stays pinned.
                if typeSize.isAccessibilitySize { SwitchRoleButton() }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .defaultScrollAnchor(.center, for: .alignment)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 20) {
                Button { Task { await model.signIn() } } label: {
                    Text("Sign in").font(.headline).frame(maxWidth: .infinity, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.busy)
                if !typeSize.isAccessibilitySize { SwitchRoleButton() }
            }
            .padding(24)
            .background(.background)
        }
        .multilineTextAlignment(.center)
    }
}

struct JoinCircleView: View {
    @Environment(FamilyModel.self) private var model
    @State private var code = ""
    @State private var name = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Invite code", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    TextField("Your name, like Maria", text: $name)
                } footer: {
                    Text("Ask the person who set up Check With Us for the invite code on their dashboard.")
                }
                if let error = model.error { Text(error).foregroundStyle(.red) }
                Button("Join") { Task { await model.join(code: code.trimmingCharacters(in: .whitespaces), name: name) } }
                    .disabled(model.busy || code.count < 8 || name.isEmpty)
                Button("Sign out", role: .destructive) { model.signOut() }
            }
            .navigationTitle("Join your family")
        }
    }
}

// MARK: - Approvals

struct HoldsView: View {
    @Environment(FamilyModel.self) private var model

    var body: some View {
        @Bindable var model = model
        let recent = model.payments.filter { $0.status != "held" }
        NavigationStack(path: $model.holdsPath) {
            List {
                Section("Waiting for you") {
                    if model.held.isEmpty {
                        Label("Nothing is waiting. \(model.protectedName) is safe.", systemImage: "checkmark.shield")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(model.held) { PaymentRow(payment: $0) }
                }
                if !recent.isEmpty {
                    Section("Recent") { ForEach(recent) { PaymentRow(payment: $0) } }
                }
                FamilyStatus()
            }
            .navigationTitle("Approvals")
            .navigationDestination(for: String.self) { PaymentDetailView(id: $0) }
            .refreshable { await model.refresh() }
        }
    }
}

struct PaymentRow: View {
    let payment: FamilyAPI.Payment
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        NavigationLink(value: payment.id) {
            // Very large text: stacked, so the amount is not squeezed into a sliver.
            let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(spacing: 12))
            layout {
                VStack(alignment: .leading, spacing: 2) {
                    Text(payment.payee.name).font(.headline)
                    Text(payment.holdReasons.first?.label ?? payment.category.label)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        // Very large text: the whole reason, not "Gift card pur...".
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                }
                Spacer(minLength: 0)
                VStack(alignment: typeSize.isAccessibilitySize ? .leading : .trailing, spacing: 4) {
                    Text(dollars(payment.amountCents)).font(.headline.monospacedDigit())
                    StatusBadge(status: payment.status)
                }
            }
            .padding(.vertical, 2)
        }
    }
}

struct PaymentDetailView: View {
    @Environment(FamilyModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    let id: String

    var body: some View {
        if let payment = model.payments.first(where: { $0.id == id }) {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        StatusBadge(status: payment.status)
                        Text(dollars(payment.amountCents))
                            .font(.system(size: 48, weight: .bold).monospacedDigit())
                        Text("\(payment.protectedName) wants to pay \(payment.payee.name)")
                            .font(.title3)
                        Text(StatusWords.detail(payment))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 6)
                }
                if !payment.holdReasons.isEmpty {
                    Section("Why we paused it") {
                        ForEach(payment.holdReasons, id: \.code) {
                            Label($0.label, systemImage: "exclamationmark.triangle.fill")
                                .symbolRenderingMode(.multicolor)
                        }
                    }
                }
                if let note = payment.explanation {
                    Section {
                        Text(note)
                    } header: {
                        Text("What \(payment.protectedName)'s phone noticed")
                    } footer: {
                        Text("Written on \(payment.protectedName)'s phone. It never decides; you do.")
                    }
                }
                Section("Details") {
                    LabeledContent("Category", value: payment.category.label)
                    LabeledContent("Payee", value: payment.payee.known ? "Paid before" : "New")
                    LabeledContent("On a phone call", value: payment.onCall ? "Yes" : "No")
                    if let created = isoDate(payment.createdAt) {
                        LabeledContent("Asked") { Text(created.formatted(.relative(presentation: .named))) }
                    }
                    if payment.status == "held", let expires = isoDate(payment.expiresAt), expires > .now {
                        LabeledContent("Blocked if no answer in") { Text(expires, style: .timer).monospacedDigit() }
                    }
                }
                if let error = model.error {
                    Text(error).foregroundStyle(.red)
                }
            }
            .navigationTitle(payment.payee.name)
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                if payment.status == "held" {
                    VStack(spacing: 8) {
                        if (payment.approvalsRequired ?? 1) > 1 {
                            Text("This needs \(payment.approvalsRequired ?? 2) family approvals.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        // Very large text: stacked, so "Approve" and "Deny" are not broken mid-word.
                        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 12))
                        layout {
                            Button(role: .destructive) { Task { await model.decide(payment, approve: false) } } label: {
                                Label("Deny", systemImage: "xmark").font(.headline).frame(maxWidth: .infinity, minHeight: 50)
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)
                            Button { Task { await model.decide(payment, approve: true) } } label: {
                                Label("Approve", systemImage: "checkmark").font(.headline).frame(maxWidth: .infinity, minHeight: 50)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.green)
                        }
                        .disabled(model.busy)
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(.bar)
                }
            }
        } else {
            ContentUnavailableView("Payment not found", systemImage: "questionmark.circle")
        }
    }
}

struct StatusBadge: View {
    let status: String

    var body: some View {
        // Dark text on a tinted capsule: colored caption text on its own tint is under 3:1.
        Text(StatusWords.label(status))
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(StatusWords.color(status).opacity(0.25), in: .capsule)
    }
}

enum StatusWords {
    static func label(_ status: String) -> String {
        switch status {
        case "held": "Waiting"
        case "approved", "paying": "Approved"
        case "paid": "Paid"
        case "denied": "Denied"
        case "expired": "Expired"
        default: "Failed"
        }
    }

    static func color(_ status: String) -> Color {
        switch status {
        case "held": .orange
        case "approved", "paying", "paid": .green
        case "expired": .gray
        default: .red
        }
    }

    static func detail(_ p: FamilyAPI.Payment) -> String {
        let by = p.decidedByName.map { " by \($0)" } ?? ""
        switch p.status {
        case "held": return "Nothing is sent until someone in the family says yes."
        case "approved", "paying": return "Approved\(by). Sending now."
        case "paid": return p.decidedByName == nil ? "Sent. It did not need an OK." : "Approved\(by) and sent."
        case "denied": return "Blocked\(by). No money was sent."
        case "expired": return "No one answered in time, so it was blocked. No money was sent."
        default: return "The bank did not accept it. No money was sent."
        }
    }
}

// MARK: - Alerts

struct AlertsView: View {
    @Environment(FamilyModel.self) private var model

    var body: some View {
        // Kinds this app does not know yet are skipped, not shown as blank rows.
        let known = model.alerts.filter { AlertWords.title($0.kind, name: $0.protectedName) != nil }
        NavigationStack {
            List {
                if known.isEmpty {
                    ContentUnavailableView("No alerts", systemImage: "bell.slash",
                                           description: Text("You will see it here if \(model.protectedName) asks for help."))
                }
                ForEach(known) { alert in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: AlertWords.symbol(alert.kind))
                            .font(.title2)
                            .foregroundStyle(alert.kind == "bank_during_call" ? .red : .orange)
                            .frame(width: 32)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(AlertWords.title(alert.kind, name: alert.protectedName) ?? "").font(.headline)
                            if let detail = alert.detail { Text(detail).font(.subheadline) }
                            if let date = isoDate(alert.createdAt) {
                                Text(date.formatted(.relative(presentation: .named))).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                }
                FamilyStatus()
            }
            .navigationTitle("Alerts")
            .refreshable { await model.refresh() }
        }
    }
}

enum AlertWords {
    static func title(_ kind: String, name: String) -> String? {
        switch kind {
        case "ask_family": "\(name) asked you to call"
        case "bank_during_call": "\(name) is at a bank during a phone call"
        default: nil
        }
    }

    static func symbol(_ kind: String) -> String {
        kind == "bank_during_call" ? "building.columns.fill" : "phone.arrow.up.right.fill"
    }
}

// MARK: - Money

struct MoneyView: View {
    @Environment(FamilyModel.self) private var model
    @State private var confirmFreeze = false
    @State private var askUnfreeze = false
    @State private var unfreezeText = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let balance = model.balance {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Available").foregroundStyle(.secondary)
                            Text(dollars(balance.availableCents)).font(.system(size: 44, weight: .bold).monospacedDigit())
                        }
                        .padding(.vertical, 4)
                        LabeledContent("In the account", value: dollars(balance.ledgerBalanceCents))
                        LabeledContent("Set aside for approved payments", value: dollars(balance.reservedCents))
                    } else {
                        Text("Loading balance").foregroundStyle(.secondary)
                    }
                } header: {
                    Text("\(model.protectedName)'s account")
                } footer: {
                    if let checked = isoDate(model.balance?.checkedAt) {
                        Text("Checked \(checked.formatted(.relative(presentation: .named)))")
                    }
                }

                Section {
                    if model.frozen {
                        Label("Frozen. Money is in the safe account.", systemImage: "snowflake")
                            .foregroundStyle(.tint)
                        Button("Unfreeze") {
                            unfreezeText = model.frozenCents > 0 ? String(format: "%d.%02d", model.frozenCents / 100, model.frozenCents % 100) : ""
                            askUnfreeze = true
                        }
                    } else {
                        Button(role: .destructive) { confirmFreeze = true } label: {
                            Label("Freeze money now", systemImage: "snowflake")
                                .foregroundStyle(Color.errorText)
                        }
                        .accessibilityInputLabels(["Freeze money now", "Freeze"])
                    }
                    if let notice = model.notice { Text(notice).foregroundStyle(.secondary) }
                    if let error = model.error { Text(error).foregroundStyle(.red) }
                } header: {
                    Text("Freeze")
                } footer: {
                    Text("Freeze moves \(model.protectedName)'s money to a safe account, so a scammer cannot take it. Unfreeze moves it back.")
                }
                .disabled(model.busy)
            }
            .navigationTitle("Money")
            .refreshable { await model.refresh() }
            .confirmationDialog("Freeze \(model.protectedName)'s money?", isPresented: $confirmFreeze, titleVisibility: .visible) {
                Button("Freeze", role: .destructive) { Task { await model.freeze() } }
            } message: {
                Text("Payments stop until you unfreeze.")
            }
            .alert("Unfreeze how much?", isPresented: $askUnfreeze) {
                TextField("Amount in dollars", text: $unfreezeText).keyboardType(.decimalPad)
                Button("Unfreeze") { if let c = cents(fromDollars: unfreezeText) { Task { await model.unfreeze(cents: c) } } }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This moves money back to \(model.protectedName)'s account.")
            }
        }
    }
}

// MARK: - Allowances

struct AllowancesView: View {
    @Environment(FamilyModel.self) private var model
    @State private var revoking: FamilyAPI.Allowance?

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            List {
                Section {
                    if model.allowances.isEmpty {
                        Text("None yet. Every risky payment asks you first.").foregroundStyle(.secondary)
                    }
                    ForEach(model.allowances) { allowance in
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(AllowanceWords.scope(allowance)) up to \(dollars(allowance.maxAmountCents))").font(.headline)
                            if let until = isoDate(allowance.expiresAt) {
                                Text("Until \(until.formatted(date: .abbreviated, time: .omitted))")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                        .swipeActions {
                            Button("Revoke", role: .destructive) { revoking = allowance }
                        }
                    }
                } footer: {
                    Text("Inside an allowance, payments to people \(model.protectedName) has paid before go through without asking you. Gift cards, crypto, wires and payments during a call always ask. Swipe left to revoke.")
                }
                if let error = model.error { Text(error).foregroundStyle(.red) }
            }
            .navigationTitle("Allowances")
            .toolbar {
                Button { model.addingAllowance = true } label: { Label("Add", systemImage: "plus") }
            }
            .sheet(isPresented: $model.addingAllowance) { GrantAllowanceView() }
            .confirmationDialog("Revoke this allowance?", isPresented: .init { revoking != nil } set: { if !$0 { revoking = nil } },
                                titleVisibility: .visible, presenting: revoking) { allowance in
                Button("Revoke", role: .destructive) { Task { await model.revoke(allowance) } }
            } message: { _ in
                Text("Payments it covered will ask you first again.")
            }
            .refreshable { await model.refresh() }
        }
    }
}

struct GrantAllowanceView: View {
    @Environment(FamilyModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var category = "utilities"
    @State private var amount = ""
    @State private var until = Calendar.current.date(byAdding: .month, value: 1, to: .now)!

    var body: some View {
        NavigationStack {
            Form {
                // ponytail: category only. A payee allowance needs payee ids, and no family route lists payees yet.
                Picker("For", selection: $category) {
                    ForEach(AllowanceWords.categories, id: \.0) { Text($0.1).tag($0.0) }
                }
                TextField("Up to, in dollars", text: $amount, prompt: Text("Up to, in dollars").foregroundStyle(Color.secondaryText))
                    .keyboardType(.decimalPad)
                DatePicker("Until", selection: $until, in: Date.now.addingTimeInterval(3600)...Date.now.addingTimeInterval(364 * 86400),
                           displayedComponents: .date)
                Section {
                    if let error = model.error { Text(error).foregroundStyle(.red) }
                } footer: {
                    Text("To keep this safe, you will sign in again before it is saved.").foregroundStyle(Color.secondaryText)
                }
            }
            .navigationTitle("New allowance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let cents = cents(fromDollars: amount) else { return }
                        Task { if await model.grant(category: category, cents: cents, until: until) { dismiss() } }
                    }
                    .disabled(model.busy || cents(fromDollars: amount) == nil)
                }
            }
        }
    }
}

enum AllowanceWords {
    /// Categories an allowance can usefully cover (web/lib/categories.ts). The risky ones always ask anyway.
    static let categories = [
        ("utilities", "Utilities"), ("groceries", "Groceries"), ("pharmacy", "Pharmacy"), ("healthcare", "Healthcare"),
        ("dining", "Dining"), ("shopping", "Shopping"), ("transport", "Transport"), ("other", "Other"),
    ]

    static func scope(_ a: FamilyAPI.Allowance) -> String {
        a.payeeName ?? categories.first { $0.0 == a.category }?.1 ?? a.category ?? "Payments"
    }
}

// MARK: - Settings

struct FamilySettingsView: View {
    @Environment(FamilyModel.self) private var model
    @State private var confirmUnpair = false

    var body: some View {
        NavigationStack {
            Form {
                if let circle = model.circle {
                    Section("Your family") {
                        LabeledContent("You", value: circle.yourName)
                        LabeledContent("Protecting", value: circle.protectedName)
                    }
                }
                Section {
                    SwitchRoleButton()
                } footer: {
                    Text("Use this if \(model.protectedName) will use this phone.")
                }
                if model.circle != nil {
                    Section {
                        Button("Unpair \(model.protectedName)'s phone", role: .destructive) { confirmUnpair = true }
                            .accessibilityInputLabels(["Unpair \(model.protectedName)'s phone", "Unpair"])
                        if let notice = model.notice { Text(notice).foregroundStyle(.secondary) }
                        if let error = model.error { Text(error).foregroundStyle(.red) }
                    } footer: {
                        Text("Only family can do this. \(model.protectedName)'s phone goes back to its first screen until you pair it again with a new code.")
                    }
                    .disabled(model.busy)
                }
                Section {
                    Button("Sign out", role: .destructive) { model.signOut() }
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Unpair \(model.protectedName)'s phone?", isPresented: $confirmUnpair, titleVisibility: .visible) {
                Button("Unpair", role: .destructive) { Task { await model.unpair() } }
            } message: {
                Text("Check With Us stops checking payments on that phone.")
            }
        }
    }
}

/// The last refresh error, quietly, at the bottom of a list.
struct FamilyStatus: View {
    @Environment(FamilyModel.self) private var model

    var body: some View {
        if let error = model.error {
            Label(error, systemImage: "wifi.exclamationmark").font(.footnote).foregroundStyle(.secondary)
        }
    }
}
