import SwiftUI

/// One screen at a time, one main action per screen. Text uses Dynamic Type styles so it grows with the
/// phone's text size; every screen scrolls so very large text never cuts off.
struct ContentView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if model.token == nil {
                PairView()
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
        .task { await model.loadConfig() }
    }
}

// MARK: - Screens

struct PairView: View {
    @Environment(AppModel.self) private var model
    @State private var code = ""

    var body: some View {
        Page {
            Text("Connect to your family")
                .font(.largeTitle.bold())
            Text("Ask your family for the code on their screen. Type it here.")
                .font(.title2)
            TextField("Code", text: $code)
                .font(.largeTitle.monospaced())
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .padding()
                .background(.quaternary, in: .rect(cornerRadius: 16))
                .accessibilityLabel("Family code")
            ErrorText()
        } action: {
            BigButton("Connect", symbol: "link") { await model.pair(code: code.trimmingCharacters(in: .whitespaces)) }
                .disabled(code.trimmingCharacters(in: .whitespaces).count < 8)
        }
    }
}

struct HomeView: View {
    @Environment(AppModel.self) private var model

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
            .onTapGesture { if paused { model.go(.status) } }
            ErrorText()
        } action: {
            BigButton("Ask my family", symbol: "person.2.fill") { await model.askFamily() }
            BigButton("Pay a bill", symbol: "dollarsign.circle", prominent: false) { model.go(.choosePayee) }
        }
    }
}

struct ChoosePayeeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Page(back: .home) {
            Text("Who do you want to pay?")
                .font(.largeTitle.bold())
            ForEach(Payee.all) { payee in
                Button { model.go(.amount(payee)) } label: {
                    Label(payee.name, systemImage: payee.symbol)
                        .font(.title2.weight(.semibold))
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
                    .foregroundStyle(.red)
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
                    .foregroundStyle(.orange)
            }
            ErrorText()
        } action: {
            BigButton("Yes, pay", symbol: "checkmark") { await model.pay(payee, cents: cents) }
            BigButton("No, go back", symbol: "xmark", prominent: false) { model.go(.home) }
        }
    }
}

struct StatusView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let outcome = model.payment?.outcome ?? "failed"
        Page {
            VStack(spacing: 16) {
                Image(systemName: OutcomeText.symbol(outcome))
                    .font(.system(size: 120))
                    .foregroundStyle(OutcomeText.color(outcome))
                    .symbolEffect(.pulse, isActive: outcome == "waiting")
                    .accessibilityHidden(true)
                Text(OutcomeText.headline(outcome))
                    .font(.largeTitle.bold())
                Text(OutcomeText.detail(outcome))
                    .font(.title2)
                if let payment = model.payment {
                    Text("\(dollars(payment.amountCents)) to \(payment.payee.name)")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(.secondary)
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
                }
                content
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 12) { action }
                .padding(.horizontal, 24)
                .padding(.bottom, 8)
        }
    }
}

struct BigButton: View {
    @Environment(AppModel.self) private var model
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
            Label(title, systemImage: symbol)
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
                .foregroundStyle(.red)
        }
    }
}

#Preview {
    ContentView().environment(AppModel())
}
