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
            Text("Connect to your family")
                .font(.largeTitle.bold())
            Text("Ask your family for the code on their screen. Type it here.")
                .font(.title2)
            TextField("Code", text: $code, prompt: Text("Code").foregroundStyle(Color.secondaryText))
                .font(.largeTitle.monospaced())
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .padding()
                .background(.quaternary, in: .rect(cornerRadius: 16))
                .accessibilityLabel("Family code")
            ErrorText()
            // Very large text: Connect scrolls with the page, so the code box is fully in view at first.
            if typeSize.isAccessibilitySize { connect }
        } action: {
            if !typeSize.isAccessibilitySize { connect }
        }
    }

    private var connect: some View {
        BigButton("Connect", symbol: "link") { await model.pair(code: code.trimmingCharacters(in: .whitespaces)) }
            .disabled(code.trimmingCharacters(in: .whitespaces).count < 8)
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
                Text("Hi \(name)").font(.title)
            }
            VStack(spacing: 16) {
                Image(systemName: paused ? "pause.circle.fill" : "checkmark.shield.fill")
                    .font(.system(size: 120))
                    .foregroundStyle(paused ? .orange : .green)
                    .accessibilityHidden(true)
                Text(paused ? OutcomeText.headline("waiting") : "You're safe")
                    .font(.largeTitle.bold())
                Text(paused ? OutcomeText.detail("waiting") : "Your family is looking out for you.")
                    .font(.title2)
            }
            .frame(maxWidth: .infinity)
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
            .font(.title3.weight(.semibold))
            .multilineTextAlignment(.center)
        }
    }
}

struct ChoosePayeeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Page(back: .home) {
            Text("Who do you want to pay?")
                .font(.largeTitle.bold())
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
                            Label(payee.name, systemImage: payee.symbol)
                        }
                    }
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
                    .padding(.horizontal)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.roundedRectangle(radius: 16))
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
                .font(.largeTitle.bold())
            HStack {
                Text("$").font(.largeTitle.bold()).accessibilityHidden(true)
                TextField("0", text: $text)
                    .font(.largeTitle.bold())
                    .keyboardType(payee.kind == "biller" ? .decimalPad : .numberPad)
                    .focused($focused)
                    .accessibilityLabel("Amount in dollars")
            }
            .padding()
            .background(.quaternary, in: .rect(cornerRadius: 16))
            if !text.isEmpty && amount == nil {
                Text(payee.kind == "biller" ? "Type an amount like 84.12" : "Use whole dollars, like 50")
                    .font(.title3)
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
                .font(.largeTitle.bold())
            if model.isOnCall {
                Text("You are on a phone call. We will ask your family first.")
                    .font(.title2)
                    .foregroundStyle(Color.warningText)
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
        Page {
            VStack(spacing: 16) {
                Image(systemName: OutcomeText.symbol(outcome))
                    .font(.system(size: 120))
                    .foregroundStyle(OutcomeText.color(outcome))
                    .symbolEffect(.pulse, isActive: outcome == "waiting" && !reduceMotion)
                    .accessibilityHidden(true)
                Text(OutcomeText.headline(outcome))
                    .font(.largeTitle.bold())
                Text(OutcomeText.detail(outcome))
                    .font(.title2)
                if let payment = model.payment {
                    Text("\(dollars(payment.amountCents)) to \(payment.payee.name)")
                        .font(.title2.weight(.semibold))
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
        Page {
            VStack(spacing: 16) {
                Image(systemName: "phone.arrow.down.left.fill")
                    .font(.system(size: 100))
                    .foregroundStyle(.green)
                    .accessibilityHidden(true)
                Text("We told your family")
                    .font(.largeTitle.bold())
                Text("They will call you soon. Do not send money to anyone until you talk to them.")
                    .font(.title2)
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
    @ViewBuilder var content: Content
    @ViewBuilder var action: Actions

    init(back: Screen? = nil, @ViewBuilder content: () -> Content, @ViewBuilder action: () -> Actions = { EmptyView() }) {
        self.back = back
        self.content = content()
        self.action = action()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let back {
                    Button { model.go(back) } label: {
                        Label("Back", systemImage: "chevron.left")
                            .font(.title2.weight(.semibold))
                            .frame(minHeight: 56)
                    }
                    .modifier(ShapeWhenAsked())
                }
                content
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollPosition($position)
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
                    .background(.background)
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
        .font(.title3.weight(.semibold))
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
    let title: String
    let symbol: String
    var prominent = true
    let action: () async -> Void

    init(_ title: String, symbol: String, prominent: Bool = true, action: @escaping () async -> Void) {
        self.title = title
        self.symbol = symbol
        self.prominent = prominent
        self.action = action
    }

    var body: some View {
        let button = Button { Task { await action() } } label: {
            Group {
                // Very large text: the words get the full width instead of wrapping beside the icon.
                if typeSize.isAccessibilitySize { Text(title) } else { Label(title, systemImage: symbol) }
            }
            .font(.title.bold())
            .frame(maxWidth: .infinity, minHeight: 80)
        }
        Group {
            if prominent { button.buttonStyle(.borderedProminent) } else { button.buttonStyle(.bordered) }
        }
        .buttonBorderShape(.roundedRectangle(radius: 20))
        .disabled(model.busy)
    }
}

/// The last error, in the server's plain words.
struct ErrorText: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let error = model.error {
            Text(error)
                .font(.title3)
                .foregroundStyle(Color.errorText)
        }
    }
}

extension Color {
    /// Text colors with at least 4.5:1 contrast on the light background. System orange, red and gray text fall short.
    /// With Increase Contrast on, the light colors get darker (7:1); the dark-mode system colors adapt on their own.
    static let warningText = Color(UIColor { $0.userInterfaceStyle == .dark ? .systemOrange : UIColor(red: $0.high ? 0.5 : 0.64, green: $0.high ? 0.2 : 0.28, blue: 0, alpha: 1) })
    static let secondaryText = Color(UIColor { $0.userInterfaceStyle == .dark ? .secondaryLabel : UIColor(white: $0.high ? 0.25 : 0.36, alpha: 1) })
    static let errorText = Color(UIColor { $0.userInterfaceStyle == .dark ? .systemRed : UIColor(red: $0.high ? 0.6 : 0.77, green: $0.high ? 0.05 : 0.12, blue: $0.high ? 0.05 : 0.12, alpha: 1) })
    /// Button tint: white on it is 6.4:1 in light mode (system blue is 3.5:1). Dark mode keeps system blue.
    static let action = Color(UIColor { $0.userInterfaceStyle == .dark ? .systemBlue : UIColor(red: 0, green: $0.high ? 0.26 : 0.34, blue: $0.high ? 0.64 : 0.8, alpha: 1) })
}

private extension UITraitCollection {
    /// Increase Contrast (Settings > Accessibility > Display & Text Size).
    var high: Bool { accessibilityContrast == .high }
}

#Preview {
    ContentView().environment(AppModel())
}
