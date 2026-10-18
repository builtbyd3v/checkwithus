import GuardKit
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
        // Figtree for every row, button and field below; titles and amounts set Gabarito themselves.
        .font(.brand(.body))
        .tint(Color.link)
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

// MARK: - Look

/// The lilac lane: purple at low strength, for highlighted cards and icon tiles. Purple text (`link`) sits on it.
/// ponytail: derived from `action` here; move it to AppTheme as a token if a second file needs it.
private extension Color {
    static let lilac = Color.action.opacity(0.14)
}

extension View {
    /// Page ground and card rows in the brand tones instead of the system grays.
    fileprivate func brandList() -> some View {
        scrollContentBackground(.hidden).background(Color.bg)
    }

    /// Large title in Gabarito. `navigationTitle` stays for the back button and the tab switcher.
    fileprivate func brandTitle(_ title: String) -> some View {
        navigationTitle(title).toolbar {
            ToolbarItem(placement: .largeTitle) {
                Text(title).font(.display(.largeTitle)).foregroundStyle(Color.ink).accessibilityAddTraits(.isHeader)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

/// A section title: Figtree semibold in ink, not the small gray caps.
private struct SectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text).font(.brand(.headline, weight: .semibold)).foregroundStyle(Color.ink).textCase(nil)
    }
}

/// Footer text under a card.
private struct Foot: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text).font(.brand(.footnote)).foregroundStyle(Color.secondaryText)
    }
}

/// The rounded icon tile at the start of a row. Decorative: the row's words say the same thing.
private struct IconTile: View {
    enum Tone { case lilac, pause, safe, stop, plain }
    let symbol: String
    var tone = Tone.lilac
    @ScaledMetric(relativeTo: .body) private var size = 36

    var body: some View {
        let (fill, ink): (Color, Color) = switch tone {
        case .lilac: (.lilac, .link)
        case .pause: (.pauseField, .pause)
        case .safe: (.safeField, .safe)
        case .stop: (.stopField, .stop)
        case .plain: (.bg, .ink)
        }
        Image(systemName: symbol)
            .font(.system(size: size * 0.5, weight: .semibold))
            .foregroundStyle(ink)
            .frame(width: size, height: size)
            .background(fill, in: .rect(cornerRadius: size * 0.3))
            .accessibilityHidden(true)
    }
}

/// Full-width capsule button. Purple with white text by default; `fill` and `text` for the quiet ones.
private struct PillButton: ButtonStyle {
    var fill = Color.action
    var text = Color.white
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.brand(.headline, weight: .semibold))
            .foregroundStyle(isEnabled ? text : Color.secondaryText)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(isEnabled ? fill : Color.surface, in: .capsule)
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
            .contentShape(.capsule)
    }
}

// MARK: - Sign in and join

struct FamilySignInView: View {
    @Environment(FamilyModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .headline) private var icon = 36

    var body: some View {
        // Scrolls, so very large text is never cut off.
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 10) {
                    Image("AppIconTile")
                        .resizable()
                        .frame(width: icon, height: icon)
                        .clipShape(.rect(cornerRadius: icon * 0.225))
                        .accessibilityHidden(true)
                    Text("checkwith.us").font(.brand(.headline, weight: .semibold))
                }
                Text("Sign in to help your family")
                    .font(.display(.largeTitle))
                    .accessibilityAddTraits(.isHeader)
                    .padding(.top, typeSize.isAccessibilitySize ? 32 : 72)
                Text("You will approve payments, see alerts and freeze money if something looks wrong.")
                    .font(.brand(.title3))
                    .padding(.top, 14)
                if let error = model.error { Text(error).foregroundStyle(Color.errorText).padding(.top, 14) }
                // Very large text: only Sign in stays pinned, and the peek card is left out.
                if typeSize.isAccessibilitySize {
                    SwitchRoleButton().foregroundStyle(Color.link).multilineTextAlignment(.leading).padding(.top, 24)
                }
            }
            .foregroundStyle(Color.ink)
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.bg)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 16) {
                if !typeSize.isAccessibilitySize { SignInPeek() }
                Button { Task { await model.signIn() } } label: { Text("Sign in") }
                    .buttonStyle(PillButton())
                    .disabled(model.busy)
                if !typeSize.isAccessibilitySize { SwitchRoleButton().font(.brand(.body)) }
            }
            .padding(.horizontal, 24)
            .padding(.top, 18)
            .padding(.bottom, 8)
            .background(Color.surface, in: UnevenRoundedRectangle(topLeadingRadius: 28, topTrailingRadius: 28))
            .background(Color.surface.ignoresSafeArea(edges: .bottom).padding(.top, 28))
        }
    }
}

/// A slice of the Approvals tab peeking in above Sign in, so a new person sees what they sign up for.
/// Sample content, hidden from VoiceOver: the words above already say it.
private struct SignInPeek: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "person.fill")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(Color.onSun)
                    .frame(width: 28, height: 28)
                    .background(Color.sun, in: .circle)
                Text("Your family is safe").font(.brand(.headline, weight: .semibold))
                Spacer(minLength: 0)
                StatusBadge(status: "paid", label: "Protected")
            }
            HStack(spacing: 12) {
                IconTile(symbol: "bolt.fill", tone: .pause)
                VStack(alignment: .leading, spacing: 2) {
                    Text("City Power & Light").font(.brand(.headline, weight: .semibold))
                    Text("Over your $300 limit").font(.brand(.subheadline)).foregroundStyle(Color.secondaryText)
                }
                Spacer(minLength: 0)
                Text("$320.00").font(.brand(.headline, weight: .semibold)).monospacedDigit()
            }
        }
        .foregroundStyle(Color.ink)
        .lineLimit(1)
        .accessibilityHidden(true)
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
                    CodeEntryField(label: "Invite code", code: $code, large: false)
                    TextField("Your name, like Maria", text: $name)
                } header: {
                    Text("Someone set up Check With Us for your family. Ask them for the invite code on their dashboard.")
                        .font(.brand(.body)).foregroundStyle(Color.ink).textCase(nil)
                        .padding(.bottom, 8)
                }
                .listRowBackground(Color.surface)
                Section {
                    if let error = model.error { Text(error).foregroundStyle(Color.errorText) }
                    Button("Join") { Task { if let canonical = ShortCode.canonical(code) { await model.join(code: canonical, name: name) } } }
                        .buttonStyle(PillButton())
                        .disabled(model.busy || ShortCode.canonical(code) == nil || name.isEmpty)
                        .listRowInsets(.init())
                }
                .listRowBackground(Color.clear)
                Section {
                    JoinPerk(symbol: "hand.raised.fill", title: "Approve or deny payments", detail: "With Face ID, from anywhere")
                    JoinPerk(symbol: "bell.fill", title: "Get alerts", detail: "Bank visits during a call, help requests")
                    JoinPerk(symbol: "snowflake", title: "Freeze money", detail: "One tap moves it to a safe account")
                } header: {
                    SectionTitle("What you can do")
                }
                .listRowBackground(Color.surface)
                Section {
                    Button("Sign out", role: .destructive) { model.signOut() }
                }
                .listRowBackground(Color.surface)
            }
            .brandList()
            .brandTitle("Join your family")
        }
    }
}

private struct JoinPerk: View {
    let symbol: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 12) {
            IconTile(symbol: symbol)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.brand(.headline, weight: .semibold))
                Text(detail).font(.brand(.subheadline)).foregroundStyle(Color.secondaryText)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
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
                // The website shows this too: while frozen, Approve fails until someone unfreezes.
                if model.frozen {
                    Button { model.tab = .money } label: {
                        Label("Money is frozen. Unfreeze it on the Money tab before you approve.", systemImage: "snowflake")
                            .font(.brand(.body, weight: .semibold))
                            .foregroundStyle(Color.errorText)
                    }
                    .listRowBackground(Color.stopField)
                }
                Section {
                    if model.held.isEmpty {
                        // Their status card in their color: ink on yellow, 10.9:1.
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "checkmark.shield.fill").font(.title2).accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(model.protectedName) is safe").font(.display(.title))
                                Text("Nothing is waiting for you.").font(.brand(.body))
                            }
                        }
                        .foregroundStyle(Color.onSun)
                        .padding(.vertical, 10)
                        .accessibilityElement(children: .combine)
                        .listRowBackground(Color.sun)
                    }
                    ForEach(model.held) { PaymentRow(payment: $0) }
                } header: {
                    SectionTitle("Waiting for you")
                }
                .listRowBackground(Color.surface)
                if !recent.isEmpty {
                    Section {
                        ForEach(recent) { PaymentRow(payment: $0) }
                    } header: {
                        SectionTitle("Recent")
                    }
                    .listRowBackground(Color.surface)
                }
                FamilyStatus()
            }
            .brandList()
            .brandTitle("Approvals")
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
                if !typeSize.isAccessibilitySize {
                    IconTile(symbol: CategoryWords.symbol(payment.category.code), tone: StatusWords.tone(payment.status))
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(payment.payee.name).font(.brand(.headline, weight: .semibold))
                    Text(payment.holdReasons.first?.label ?? payment.category.label)
                        .font(.brand(.subheadline))
                        .foregroundStyle(Color.secondaryText)
                        // Very large text: the whole reason, not "Gift card pur...".
                        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
                }
                Spacer(minLength: 0)
                VStack(alignment: typeSize.isAccessibilitySize ? .leading : .trailing, spacing: 4) {
                    Text(dollars(payment.amountCents)).font(.brand(.headline, weight: .semibold)).monospacedDigit()
                    StatusBadge(status: payment.status)
                }
            }
            .padding(.vertical, 4)
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
                            // ponytail: Font.display has no size; 52 pt Gabarito scaled like largeTitle, as in the mockup.
                            .font(.custom("Gabarito-ExtraBold", size: 52, relativeTo: .largeTitle))
                            .monospacedDigit()
                        Text("\(payment.protectedName) wants to pay \(Text(payment.payee.name).font(.brand(.title3, weight: .semibold)))")
                            .font(.brand(.title3))
                        Text(StatusWords.detail(payment))
                            .foregroundStyle(Color.secondaryText)
                        if payment.status == "held", let expires = isoDate(payment.expiresAt), expires > .now {
                            DecideClock(start: isoDate(payment.createdAt), end: expires)
                        }
                    }
                    .padding(.vertical, 6)
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init(top: 0, leading: 4, bottom: 0, trailing: 4))
                }
                if !payment.holdReasons.isEmpty {
                    Section {
                        ForEach(payment.holdReasons, id: \.code) { reason in
                            HStack(spacing: 12) {
                                IconTile(symbol: "exclamationmark.triangle.fill", tone: .pause)
                                Text(reason.label)
                            }
                        }
                    } header: {
                        SectionTitle("Why we paused it")
                    }
                    .listRowBackground(Color.surface)
                }
                if let note = payment.explanation {
                    Section {
                        Text(note)
                    } header: {
                        SectionTitle("What \(payment.protectedName)'s phone noticed")
                    } footer: {
                        Foot("Written on \(payment.protectedName)'s phone. It never decides; you do.")
                    }
                    .listRowBackground(Color.lilac)
                }
                Section {
                    LabeledContent("Category", value: payment.category.label)
                    LabeledContent("Payee", value: payment.payee.known ? "Paid before" : "New")
                    LabeledContent("On a phone call", value: payment.onCall ? "Yes" : "No")
                    if let created = isoDate(payment.createdAt) {
                        LabeledContent("Asked") { Text(created.formatted(.relative(presentation: .named))) }
                    }
                } header: {
                    SectionTitle("Details")
                }
                .listRowBackground(Color.surface)
                // A held payment shows its error next to the buttons instead.
                if payment.status != "held", let error = model.error {
                    Text(error).foregroundStyle(Color.errorText).listRowBackground(Color.surface)
                }
            }
            .brandList()
            .navigationTitle(payment.payee.name)
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                if payment.status == "held" {
                    VStack(spacing: 8) {
                        // Next to the buttons, so a failed Approve (for example while frozen) says why.
                        if let error = model.error {
                            Text(error).font(.brand(.callout, weight: .semibold)).foregroundStyle(Color.errorText)
                        } else if model.frozen {
                            Text("Money is frozen. Unfreeze it on the Money tab before you approve.")
                                .font(.brand(.callout, weight: .semibold)).foregroundStyle(Color.errorText)
                        }
                        if (payment.approvalsRequired ?? 1) > 1 {
                            Text("This needs \(payment.approvalsRequired ?? 2) family approvals.")
                                .font(.brand(.footnote))
                                .foregroundStyle(Color.secondaryText)
                        }
                        // Very large text: stacked, so "Approve" and "Deny" are not broken mid-word.
                        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 10))
                        layout {
                            Button(role: .destructive) { Task { await model.decide(payment, approve: false) } } label: {
                                Label("Deny", systemImage: "xmark")
                            }
                            .buttonStyle(PillButton(fill: .stopField, text: .errorText))
                            // Approve gets the wider half, as in the mockup.
                            .frame(maxWidth: typeSize.isAccessibilitySize ? .infinity : 140)
                            Button { Task { await model.decide(payment, approve: true) } } label: {
                                Label("Approve", systemImage: "faceid")
                            }
                            .buttonStyle(PillButton())
                        }
                        .disabled(model.busy)
                    }
                    .padding(.horizontal)
                    .padding(.top, 14)
                    .padding(.bottom, 8)
                    .background(.bar)
                }
            }
        } else {
            ContentUnavailableView("Payment not found", systemImage: "questionmark.circle")
        }
    }
}

/// Time left to answer a held payment, on its pause field, with a bar that drains.
private struct DecideClock: View {
    let start: Date?
    let end: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(end, style: .timer).font(.display(.title2)).monospacedDigit()
                Text("left to decide").font(.brand(.body))
            }
            if let start, start < end {
                ProgressView(timerInterval: start...end, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                    .tint(Color.pause)
                    .accessibilityHidden(true)
            }
            Text("If no one answers, it is blocked. No money is sent.")
                .font(.brand(.footnote))
                .foregroundStyle(Color.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(Color.ink)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.pauseField, in: .rect(cornerRadius: 18))
        .padding(.top, 6)
        .accessibilityElement(children: .combine)
    }
}

struct StatusBadge: View {
    let status: String
    /// Words other than the status name, for the Sign in sample.
    var label: String?

    var body: some View {
        // Ink on the status field color: colored caption text on its own tint is under 3:1. The icon carries the color.
        HStack(spacing: 4) {
            Image(systemName: StatusWords.symbol(status))
                .font(.caption2.weight(.heavy))
                .foregroundStyle(StatusWords.ink(status))
                .accessibilityHidden(true)
            Text(label ?? StatusWords.label(status))
        }
        .font(.brand(.caption, weight: .semibold))
        .foregroundStyle(Color.ink)
        .padding(.leading, 7)
        .padding(.trailing, 9)
        .padding(.vertical, 3)
        .background(StatusWords.color(status), in: .capsule)
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
        case "held": .pauseField
        case "approved", "paying", "paid": .safeField
        case "expired": .surface
        default: .stopField
        }
    }

    /// The status color for icons, 3.7:1 or better on `color`.
    static func ink(_ status: String) -> Color {
        switch status {
        case "held": .pause
        case "approved", "paying", "paid": .safe
        case "expired": .secondaryText
        default: .stop
        }
    }

    static func symbol(_ status: String) -> String {
        switch status {
        case "held", "expired": "clock.fill"
        case "approved", "paying", "paid": "checkmark"
        default: "xmark"
        }
    }

    fileprivate static func tone(_ status: String) -> IconTile.Tone {
        switch status {
        case "held": .pause
        case "approved", "paying", "paid": .safe
        case "expired": .plain
        default: .stop
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

/// One symbol per spending category (web/lib/categories.ts codes), for row icon tiles.
enum CategoryWords {
    static func symbol(_ code: String?) -> String {
        switch code {
        case "gift_cards": "gift.fill"
        case "utilities": "bolt.fill"
        case "groceries": "cart.fill"
        case "pharmacy": "pills.fill"
        case "healthcare": "cross.case.fill"
        case "dining": "fork.knife"
        case "shopping": "bag.fill"
        case "transport": "car.fill"
        case "crypto": "bitcoinsign.circle.fill"
        default: "dollarsign"
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
                        .listRowBackground(Color.clear)
                }
                Section {
                    ForEach(known) { alert in
                        HStack(alignment: .top, spacing: 12) {
                            IconTile(symbol: AlertWords.symbol(alert.kind), tone: alert.kind == "bank_during_call" ? .stop : .pause)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(AlertWords.title(alert.kind, name: alert.protectedName) ?? "").font(.brand(.headline, weight: .semibold))
                                if let detail = alert.detail {
                                    Text(detail).font(.brand(.subheadline)).foregroundStyle(Color.secondaryText)
                                }
                                if let date = isoDate(alert.createdAt) {
                                    Text(date.formatted(.relative(presentation: .named))).font(.brand(.caption)).foregroundStyle(Color.secondaryText)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                        .accessibilityElement(children: .combine)
                    }
                }
                .listRowBackground(Color.surface)
                FamilyStatus()
            }
            .brandList()
            .brandTitle("Alerts")
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
                            Text(dollars(balance.availableCents))
                                // ponytail: same 52 pt Gabarito as the payment amount; Font.display has no size.
                                .font(.custom("Gabarito-ExtraBold", size: 52, relativeTo: .largeTitle))
                                .monospacedDigit()
                            Text(balanceMeta(balance)).font(.brand(.subheadline)).foregroundStyle(Color.secondaryText)
                        }
                        .accessibilityElement(children: .combine)
                        .listRowBackground(Color.clear)
                        .listRowInsets(.init(top: 0, leading: 4, bottom: 8, trailing: 4))
                    } else {
                        Text("Loading balance").foregroundStyle(Color.secondaryText).listRowBackground(Color.clear)
                    }
                }
                if let balance = model.balance {
                    Section {
                        LabeledContent("In the account", value: dollars(balance.ledgerBalanceCents))
                        LabeledContent("Set aside for approved payments", value: dollars(balance.reservedCents))
                    }
                    .monospacedDigit()
                    .listRowBackground(Color.surface)
                }

                Section {
                    if model.frozen {
                        // One lilac card: the state and the way back out of it.
                        VStack(alignment: .leading, spacing: 14) {
                            Label("Frozen. Money is in the safe account.", systemImage: "snowflake")
                                .font(.brand(.body, weight: .semibold))
                                .foregroundStyle(Color.link)
                            Button("Unfreeze") {
                                unfreezeText = model.frozenCents > 0 ? String(format: "%d.%02d", model.frozenCents / 100, model.frozenCents % 100) : ""
                                askUnfreeze = true
                            }
                            .buttonStyle(PillButton())
                        }
                        .padding(.vertical, 6)
                        .listRowBackground(Color.lilac)
                    } else {
                        Button(role: .destructive) { confirmFreeze = true } label: {
                            Label("Freeze money now", systemImage: "snowflake")
                        }
                        .buttonStyle(PillButton(fill: .surface, text: .ink))
                        .accessibilityInputLabels(["Freeze money now", "Freeze"])
                        .listRowBackground(Color.clear)
                        .listRowInsets(.init())
                    }
                    if let notice = model.notice { Text(notice).foregroundStyle(Color.secondaryText).listRowBackground(Color.clear) }
                    if let error = model.error { Text(error).foregroundStyle(Color.errorText).listRowBackground(Color.clear) }
                } header: {
                    SectionTitle("Freeze")
                } footer: {
                    Foot("Freeze moves \(model.protectedName)'s money to a safe account, so a scammer cannot take it. Unfreeze moves it back.")
                }
                .disabled(model.busy)
            }
            .brandList()
            .brandTitle("Money")
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

    private func balanceMeta(_ balance: FamilyAPI.Balance) -> String {
        let checked = isoDate(balance.checkedAt).map { " · checked \($0.formatted(.relative(presentation: .named)))" } ?? ""
        return "Available in \(model.protectedName)'s account\(checked)"
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
                        Text("None yet. Every risky payment asks you first.").foregroundStyle(Color.secondaryText)
                    }
                    ForEach(model.allowances) { allowance in
                        HStack(spacing: 12) {
                            IconTile(symbol: allowance.payeeName == nil ? CategoryWords.symbol(allowance.category) : "person.fill")
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(AllowanceWords.scope(allowance)) up to \(dollars(allowance.maxAmountCents))")
                                    .font(.brand(.headline, weight: .semibold))
                                if let until = isoDate(allowance.expiresAt) {
                                    Text("Until \(until.formatted(date: .abbreviated, time: .omitted))")
                                        .font(.brand(.subheadline)).foregroundStyle(Color.secondaryText)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                        .accessibilityElement(children: .combine)
                        .swipeActions {
                            Button("Revoke", role: .destructive) { revoking = allowance }
                        }
                    }
                } header: {
                    Text("Inside an allowance, payments to people \(model.protectedName) has paid before go through without asking you.")
                        .font(.brand(.body)).foregroundStyle(Color.ink).textCase(nil)
                        .padding(.bottom, 8)
                } footer: {
                    Foot("Swipe left to revoke.")
                }
                .listRowBackground(Color.surface)
                Section {
                    AlwaysAsks(title: "Gift cards, crypto and wires", detail: "No allowance can cover these")
                    AlwaysAsks(title: "Payments during a phone call", detail: "Scammers keep people on the line")
                    AlwaysAsks(title: "Anyone new", detail: "First payment to a new payee")
                } header: {
                    SectionTitle("Always asks you")
                }
                .listRowBackground(Color.surface)
                if let error = model.error { Text(error).foregroundStyle(Color.errorText).listRowBackground(Color.surface) }
            }
            .brandList()
            .navigationTitle("Allowances")
            // Inline title: Add sits on the same line as "Allowances" (tester ask), not above a large title.
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Allowances").font(.display(.headline)).foregroundStyle(Color.ink).accessibilityAddTraits(.isHeader)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { model.addingAllowance = true } label: { Label("Add", systemImage: "plus") }
                }
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

private struct AlwaysAsks: View {
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 12) {
            IconTile(symbol: "lock.fill", tone: .plain)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.brand(.headline, weight: .semibold))
                Text(detail).font(.brand(.subheadline)).foregroundStyle(Color.secondaryText)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

struct GrantAllowanceView: View {
    @Environment(FamilyModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var category = "utilities"
    @State private var amount = ""
    @State private var until = Calendar.current.date(byAdding: .month, value: 1, to: .now)!
    @FocusState private var amountFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                // ponytail: category only. A payee allowance needs payee ids, and no family route lists payees yet.
                Section {
                    // Chips in a row that scrolls sideways, so very large text never wraps them into a tall pile.
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(AllowanceWords.categories, id: \.0) { code, label in
                                let on = code == category
                                Button { category = code } label: {
                                    Label(label, systemImage: CategoryWords.symbol(code))
                                        .font(.brand(.callout, weight: on ? .semibold : .medium))
                                        .foregroundStyle(on ? Color.white : Color.ink)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 9)
                                        .background(on ? Color.action : Color.surface, in: .capsule)
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(on ? .isSelected : [])
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                    .listRowInsets(.init())
                    .listRowBackground(Color.clear)
                } header: {
                    SectionTitle("For")
                }
                Section {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Up to, in dollars").font(.brand(.footnote)).foregroundStyle(amountFocused ? Color.link : Color.secondaryText)
                        TextField("Up to, in dollars", text: $amount, prompt: Text("0").foregroundStyle(Color.secondaryText))
                            .font(.display(.largeTitle))
                            .keyboardType(.decimalPad)
                            .focused($amountFocused)
                    }
                    .padding(.vertical, 4)
                    .listRowBackground(amountFocused ? Color.lilac : Color.surface)
                    DatePicker("Until", selection: $until, in: Date.now.addingTimeInterval(3600)...Date.now.addingTimeInterval(364 * 86400),
                               displayedComponents: .date)
                        .listRowBackground(Color.surface)
                }
                Section {
                    if let error = model.error { Text(error).foregroundStyle(Color.errorText).listRowBackground(Color.surface) }
                } footer: {
                    Foot("To keep this safe, you will sign in again before it is saved.")
                }
            }
            .brandList()
            .navigationTitle("New allowance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("New allowance").font(.display(.headline)).foregroundStyle(Color.ink).accessibilityAddTraits(.isHeader)
                }
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
    @ScaledMetric(relativeTo: .title) private var avatar = 56
    @ScaledMetric(relativeTo: .body) private var memberAvatar = 34

    var body: some View {
        NavigationStack {
            Form {
                if let circle = model.circle {
                    Section {
                        HStack(spacing: 14) {
                            Text(String(circle.protectedName.prefix(1)))
                                .font(.brand(.title2, weight: .semibold))
                                .foregroundStyle(Color.onSun)
                                .frame(width: avatar, height: avatar)
                                .background(Color.sun, in: .circle)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(circle.protectedName).font(.display(.title2))
                                Text("Protected by your family").font(.brand(.subheadline)).foregroundStyle(Color.secondaryText)
                            }
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Protecting \(circle.protectedName)")
                        .listRowBackground(Color.clear)
                        .listRowInsets(.init(top: 0, leading: 4, bottom: 4, trailing: 4))
                    }
                    Section {
                        HStack(spacing: 12) {
                            Text(String(circle.yourName.prefix(1)))
                                .font(.brand(.headline, weight: .semibold))
                                .foregroundStyle(Color.white)
                                .frame(width: memberAvatar, height: memberAvatar)
                                .background(Color.action, in: .circle)
                                .accessibilityHidden(true)
                            Text("\(circle.yourName) (you)").font(.brand(.headline, weight: .semibold))
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("You, \(circle.yourName)")
                    } header: {
                        SectionTitle("Members")
                    }
                    .listRowBackground(Color.surface)
                }
                Section {
                    TextSizeChoices()
                } header: {
                    SectionTitle("Text size")
                } footer: {
                    Foot("Changes only this app. \"Same as iPhone\" uses your iPhone's text size.")
                }
                .listRowBackground(Color.surface)
                Section {
                    SwitchRoleButton()
                } footer: {
                    Foot("Use this if \(model.protectedName) will use this phone.")
                }
                .listRowBackground(Color.surface)
                if model.circle != nil {
                    Section {
                        Button("Unpair \(model.protectedName)'s phone", role: .destructive) { confirmUnpair = true }
                            .accessibilityInputLabels(["Unpair \(model.protectedName)'s phone", "Unpair"])
                        if let notice = model.notice { Text(notice).foregroundStyle(Color.secondaryText) }
                        if let error = model.error { Text(error).foregroundStyle(Color.errorText) }
                    } footer: {
                        Foot("Only family can do this. \(model.protectedName)'s phone goes back to its first screen until you pair it again with a new code.")
                    }
                    .listRowBackground(Color.surface)
                    .disabled(model.busy)
                }
                Section {
                    Button("Sign out", role: .destructive) { model.signOut() }
                }
                .listRowBackground(Color.surface)
            }
            .brandList()
            .brandTitle("Settings")
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
            Label(error, systemImage: "wifi.exclamationmark")
                .font(.brand(.footnote))
                .foregroundStyle(Color.secondaryText)
                .listRowBackground(Color.clear)
        }
    }
}
