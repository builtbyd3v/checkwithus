import GuardKit
import SwiftUI

/// One screen at a time, one main action per screen. Text uses Dynamic Type styles so it grows with the
/// phone's text size; every screen scrolls so very large text never cuts off.
struct ContentView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if model.token == nil {
                PairView()
            } else if BankWatcher.shared.needsPermission {
                BankPermissionView()
            } else {
                switch model.screen {
                case .home: HomeView()
                case .choosePayee: ChoosePayeeView()
                case .amount(let payee): AmountView(payee: payee)
                case .confirm(let payee, let cents): ConfirmView(payee: payee, cents: cents)
                case .status: StatusView()
                case .asked: AskedView()
                }
            }
        }
        .task {
            await model.installScamNumbers()
            await model.loadConfig()
            await model.resume()
        }
    }
}

// MARK: - Screens

struct PairView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var code = ""

    var body: some View {
        Page {
            AppIconTile(size: 64)
            Text("Connect to your family")
                .font(.display(.largeTitle))
            Text("Ask your family for the code on their screen. Type it here.")
                .font(.brand(.title2))
            CodeEntryField(label: "Family code", code: $code) { Task { await pair() } }
            ErrorText()
            // Very large text: Connect scrolls with the page, so the code box is fully in view at first.
            if typeSize.isAccessibilitySize { connect }
        } action: {
            if !typeSize.isAccessibilitySize { connect }
        }
    }

    private var connect: some View {
        BigButton("Connect", symbol: "link") { await pair() }
            .disabled(ShortCode.canonical(code) == nil)
    }

    private func pair() async {
        if let canonical = ShortCode.canonical(code) { await model.pair(code: canonical) }
    }
}

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let outcome = model.payment?.outcome
        let paused = outcome == "waiting" || outcome == "sending"
        Page {
            if let name = model.config?.protectedName {
                Text("Hi \(name)").font(.brand(.title))
            }
            VStack(spacing: 16) {
                Image(systemName: paused ? "pause.circle.fill" : "checkmark.shield.fill")
                    .font(.system(size: 120))
                    .foregroundStyle(paused ? Color.pause : Color.safe)
                    .accessibilityHidden(true)
                Text(paused ? OutcomeText.headline("waiting") : "You're safe")
                    .font(.hero)
                Text(paused ? OutcomeText.detail("waiting") : "Your family is looking out for you.")
                    .font(.brand(.title2))
            }
            .padding(28)
            .frame(maxWidth: .infinity)
            .background(paused ? Color.pauseField : Color.safeField, in: .rect(cornerRadius: 32))
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(paused ? .isButton : [])
            .accessibilityHint(paused ? "Shows the paused payment." : "")
            .accessibilityInputLabels(paused ? ["Show payment", "Payment"] : [])
            .onTapGesture { if paused { model.go(.status) } }
            // Read the change aloud when a payment pauses or settles while Home is open.
            // The real outcome, so "Stopped" or "It did not go through" is heard too.
            .onChange(of: paused) {
                AccessibilityNotification.Announcement(outcome.map(OutcomeText.headline) ?? "You're safe").post()
            }
            ErrorText()
            // Very large text: only the main button stays pinned, the rest scrolls with the page.
            if typeSize.isAccessibilitySize { more }
            #if DEBUG
            // Hidden in -preview screenshots.
            if UserDefaults.standard.string(forKey: "preview") == nil { BankDebugPanel() }
            #endif
        } action: {
            BigButton("Ask my family", symbol: "person.2.fill") { await model.askFamily() }
            // The other buttons scroll at this size; this says so and takes you there.
            if typeSize.isAccessibilitySize { MoreBelowButton() } else { more }
        }
        // Text size sits top right, as a settings button, so it never competes with the main action.
        .safeAreaInset(edge: .top, spacing: 0) {
            HStack { Spacer(); TextSizeButton() }.background(Color.bg)
        }
    }

    @ViewBuilder private var more: some View {
        BigButton("Pay a bill", symbol: "dollarsign.circle", prominent: false) { model.go(.choosePayee) }
        BankAlwaysNote()
        if model.callLabelsOff {
            // One-time setup, usually done by the family: iOS only lets Settings turn the extension on.
            Button { model.openCallSettings() } label: {
                Text("Turn on scam call warnings")
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .contentShape(.rect)
            }
            .modifier(ShapeWhenAsked())
            .accessibilityInputLabels(["Scam call warnings", "Turn on scam call warnings"])
            .font(.brand(.title3, weight: .semibold))
            .multilineTextAlignment(.center)
        }
    }
}

struct ChoosePayeeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    /// One icon column, so every name starts at the same place.
    @ScaledMetric(relativeTo: .title2) private var iconWidth = 32

    var body: some View {
        Page(back: .home) {
            Text("Who do you want to pay?")
                .font(.display(.largeTitle))
            ForEach(Payee.all) { payee in
                Button { model.go(.amount(payee)) } label: {
                    // Very large text: icon above the name, so the name gets the full width.
                    Group {
                        if typeSize.isAccessibilitySize {
                            VStack(alignment: .leading, spacing: 8) {
                                Image(systemName: payee.symbol).accessibilityHidden(true)
                                Text(payee.name)
                            }
                        } else {
                            // A trailing chevron, so each row reads as tappable.
                            HStack(spacing: 16) {
                                Image(systemName: payee.symbol).frame(width: iconWidth).accessibilityHidden(true)
                                Text(payee.name).frame(maxWidth: .infinity, alignment: .leading)
                                Image(systemName: "chevron.right")
                                    .font(.brand(.body, weight: .semibold))
                                    .foregroundStyle(Color.secondaryText)
                                    .accessibilityHidden(true)
                            }
                        }
                    }
                    .font(.brand(.title2, weight: .semibold))
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
                    .padding(.leading, 8)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.surface)
                .foregroundStyle(Color.ink)
                .buttonBorderShape(.roundedRectangle(radius: 20))
            }
        }
    }
}

struct AmountView: View {
    @Environment(AppModel.self) private var model
    let payee: Payee
    @State private var text = ""
    @FocusState private var focused: Bool

    private var amount: Int? {
        guard let c = cents(fromDollars: text) else { return nil }
        // Nessie drops cents for merchants and people (web/INTEGRATION.md), so only bills take cents.
        return payee.kind == "biller" || c % 100 == 0 ? c : nil
    }

    var body: some View {
        Page(back: .choosePayee) {
            Text("How much to \(payee.name)?")
                .font(.display(.largeTitle))
            HStack {
                Text("$").font(.brand(.largeTitle, weight: .bold)).accessibilityHidden(true)
                TextField("0", text: $text)
                    .font(.brand(.largeTitle, weight: .bold))
                    .tint(Color.action)
                    .keyboardType(payee.kind == "biller" ? .decimalPad : .numberPad)
                    .focused($focused)
                    .accessibilityLabel("Amount in dollars")
            }
            .padding(20)
            .background(Color.surface, in: .rect(cornerRadius: 20))
            if !text.isEmpty && amount == nil {
                Text(payee.kind == "biller" ? "Type an amount like 84.12" : "Use whole dollars, like 50")
                    .font(.brand(.title3))
                    .foregroundStyle(Color.errorText)
            }
        } action: {
            BigButton("Next", symbol: "arrow.right") { if let amount { model.go(.confirm(payee, cents: amount)) } }
                .disabled(amount == nil)
        }
        .onAppear { focused = true }
    }
}

struct ConfirmView: View {
    @Environment(AppModel.self) private var model
    let payee: Payee
    let cents: Int

    var body: some View {
        Page(back: .amount(payee)) {
            Text("Pay \(dollars(cents)) to \(payee.name)?")
                .font(.display(.largeTitle))
            if model.isOnCall {
                // Icon and words, so the call state never depends on color.
                Label("You are on a phone call. We will ask your family first.", systemImage: "phone.fill")
                    .font(.brand(.title2))
                    .foregroundStyle(Color.warningText)
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.pauseField, in: .rect(cornerRadius: 20))
            }
            ErrorText()
        } action: {
            BigButton("Yes, pay", symbol: "checkmark") { await model.pay(payee, cents: cents) }
            BigButton("No, go back", symbol: "xmark", prominent: false) { model.go(.home) }
                .accessibilityInputLabels(["No, go back", "Go back", "No"])
        }
    }
}

struct StatusView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let outcome = model.payment?.outcome ?? "failed"
        // The whole page takes the status color, with the icon and words on top.
        Page(field: OutcomeText.field(outcome), centered: true) {
            VStack(spacing: 16) {
                Image(systemName: OutcomeText.symbol(outcome))
                    .font(.system(size: 120))
                    .foregroundStyle(OutcomeText.color(outcome))
                    .symbolEffect(.pulse, isActive: outcome == "waiting" && !reduceMotion)
                    .accessibilityHidden(true)
                Text(OutcomeText.headline(outcome))
                    .font(.hero)
                Text(OutcomeText.detail(outcome))
                    .font(.brand(.title2))
                if let payment = model.payment {
                    Text("\(dollars(payment.amountCents)) to \(payment.payee.name)")
                        .font(.brand(.title2, weight: .semibold))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 14)
                        .background(Color.bg, in: .rect(cornerRadius: 20))
                }
            }
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .combine)
            // Read the change aloud when the family decides, without the user having to look for it.
            .onChange(of: outcome) { _, new in
                AccessibilityNotification.Announcement(OutcomeText.headline(new)).post()
            }
        } action: {
            BigButton("OK", symbol: "house.fill") { model.go(.home) }
        }
    }
}

struct AskedView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Page(centered: true) {
            VStack(spacing: 16) {
                Image(systemName: "phone.arrow.down.left.fill")
                    .font(.system(size: 100))
                    .foregroundStyle(Color.safe)
                    .accessibilityHidden(true)
                Text("We told your family")
                    .font(.display(.largeTitle))
                Text("They will call you soon. Do not send money to anyone until you talk to them.")
                    .font(.brand(.title2))
            }
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .combine)
        } action: {
            BigButton("OK", symbol: "house.fill") { model.go(.home) }
        }
    }
}

// MARK: - Building blocks

/// Content on top, big buttons pinned to the bottom, an optional big Back button.
struct Page<Content: View, Actions: View>: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var position = ScrollPosition()
    var back: Screen?
    /// Page color: the plain ground, or a status color on Paused, Stopped and Paid.
    var field = Color.bg
    /// Centered while it fits (status screens); it still scrolls at very large text.
    var centered = false
    @ViewBuilder var content: Content
    @ViewBuilder var action: Actions

    init(back: Screen? = nil, field: Color = .bg, centered: Bool = false, @ViewBuilder content: () -> Content, @ViewBuilder action: () -> Actions = { EmptyView() }) {
        self.back = back
        self.field = field
        self.centered = centered
        self.content = content()
        self.action = action()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let back {
                    Button { model.go(back) } label: {
                        Label("Back", systemImage: "chevron.left")
                            .font(.brand(.title2, weight: .semibold))
                            .frame(minHeight: 56)
                    }
                    .modifier(ShapeWhenAsked())
                }
                content
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .defaultScrollAnchor(centered ? .center : .top, for: .alignment)
        .scrollPosition($position)
        .background(field.ignoresSafeArea())
        // Shows the scroll bar briefly, a hint that very large text continues below.
        .scrollIndicatorsFlash(onAppear: true)
        .safeAreaInset(edge: .bottom) {
            // No bar at all on a page without actions.
            if Actions.self != EmptyView.self {
                VStack(spacing: 12) { action }
                    // Its full height always, so a big button is never cut to "Ask my fa...".
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 24)
                    .padding(.top, 12)
                    .padding(.bottom, 8)
                    // Opaque, so text scrolling under the buttons never shows through them.
                    .background(field)
                    .environment(\.scrollToBottom) {
                        withAnimation(reduceMotion ? nil : .default) { position.scrollTo(edge: .bottom) }
                    }
            }
        }
    }
}

/// Its own view, so it reads the scroll action Page puts in the bar's environment.
struct MoreBelowButton: View {
    @Environment(\.scrollToBottom) private var scrollToBottom

    var body: some View {
        Button { scrollToBottom() } label: {
            Label("More below", systemImage: "chevron.down")
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(.rect)
        }
        .modifier(ShapeWhenAsked())
        .font(.brand(.title3, weight: .semibold))
        // ponytail: capped so the hint stays one line and leaves room for the page; VoiceOver users get the hint.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .accessibilityHint("Shows Pay a bill and more.")
    }
}

/// Text-only buttons get a visible shape when Button Shapes is on (Settings > Accessibility > Display & Text Size).
/// The big buttons are bordered already.
struct ShapeWhenAsked: ViewModifier {
    @Environment(\.accessibilityShowButtonShapes) private var showShapes

    func body(content: Content) -> some View {
        if showShapes { content.buttonStyle(.bordered) } else { content }
    }
}

extension EnvironmentValues {
    /// Scrolls the current Page to its end (Home's "More below").
    @Entry var scrollToBottom: () -> Void = {}
}

struct BigButton: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.isEnabled) private var isEnabled
    let title: String
    /// No symbol: words only (the Welcome screen).
    let symbol: String?
    var prominent = true
    /// Yellow fill: the older adult's own choice on the role picker, as in the logo.
    var sun = false
    let action: () async -> Void

    init(_ title: String, symbol: String? = nil, prominent: Bool = true, sun: Bool = false, action: @escaping () async -> Void) {
        self.title = title
        self.symbol = symbol
        self.prominent = prominent
        self.sun = sun
        self.action = action
    }

    var body: some View {
        let button = Button { Task { await action() } } label: {
            Group {
                // Very large text: the words get the full width instead of wrapping beside the icon.
                if let symbol, !typeSize.isAccessibilitySize { Label(title, systemImage: symbol) } else { Text(title) }
            }
            .font(.brand(.title, weight: .bold))
            .frame(maxWidth: .infinity, minHeight: 80)
        }
        // Filled, no outlines: purple with white text, yellow or the surface tone with ink text.
        let fill = sun ? Color.sun : prominent ? Color.action : Color.surface
        let text = sun ? Color.onSun : prominent ? Color.white : Color.ink
        button
            .buttonStyle(.borderedProminent)
            .tint(fill)
            // Disabled keeps the system's dimmed look.
            .foregroundStyle(isEnabled && !model.busy ? text : Color.secondaryText)
            .buttonBorderShape(.roundedRectangle(radius: 24))
            .disabled(model.busy)
    }
}

/// The app icon as a rounded tile (22.5% corners, as on the Home Screen), with a hairline so it holds its edge on bg.
struct AppIconTile: View {
    let size: CGFloat

    var body: some View {
        Image("AppIconTile")
            .resizable()
            .frame(width: size, height: size)
            .clipShape(.rect(cornerRadius: size * 0.225))
            .overlay { RoundedRectangle(cornerRadius: size * 0.225).strokeBorder(Color.ink.opacity(0.1)) }
            .accessibilityHidden(true)
    }
}

/// Top right on Pair and Home: the older adult's only setting. Nothing in it leads to the family side.
struct TextSizeButton: View {
    @State private var choosing = false

    var body: some View {
        Button { choosing = true } label: {
            Image(systemName: "textformat.size")
                .font(.brand(.title2, weight: .semibold))
                .foregroundStyle(Color.secondaryText)
                .frame(minWidth: 56, minHeight: 56)
                .contentShape(.rect)
        }
        .modifier(ShapeWhenAsked())
        .padding(.trailing, 8)
        .accessibilityLabel("Text size")
        .accessibilityInputLabels(["Text size", "Text", "Settings"])
        .sheet(isPresented: $choosing) { TextSizeSheet() }
    }
}

extension Font {
    /// The 40 pt status headline (Home, Status), Gabarito, scaling with Dynamic Type from the large title.
    /// ponytail: names the font here; move into AppTheme as a Font.display size if the lead wants one place.
    static let hero = Font.custom("Gabarito-ExtraBold", size: 40, relativeTo: .largeTitle)
}

/// The last error, in the server's plain words.
struct ErrorText: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let error = model.error {
            Text(error)
                .font(.brand(.title3))
                .foregroundStyle(Color.errorText)
        }
    }
}

#Preview {
    ContentView().environment(AppModel())
}
