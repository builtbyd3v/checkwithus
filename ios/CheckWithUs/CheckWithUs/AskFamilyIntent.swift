import AppIntents

/// "Ask my family" from Siri, Shortcuts or the Action button, without finding the app. It sends only the
/// ask-family alert, the same as the Home button. It never moves money.
struct AskFamilyIntent: AppIntent {
    static let title: LocalizedStringResource = "Ask my family"
    static let description = IntentDescription("Tells your family you need help. They will call you.")
    // Works on a locked phone: it only sends an alert, and asking for help should never need a passcode.
    static let authenticationPolicy = IntentAuthenticationPolicy.alwaysAllowed

    @MainActor func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let token = TokenStore.load() else {
            return .result(dialog: "This phone is not connected to your family yet.")
        }
        do {
            try await API.askFamily(token: token)
        } catch {
            return .result(dialog: "\(error.localizedDescription)")
        }
        return .result(dialog: "We told your family. They will call you soon. Do not send money to anyone until you talk to them.")
    }
}

struct CheckWithUsShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskFamilyIntent(),
            phrases: ["Ask my family in \(.applicationName)", "Ask my family with \(.applicationName)", "\(.applicationName) ask my family"],
            shortTitle: "Ask my family",
            systemImageName: "person.2.fill")
    }
}
