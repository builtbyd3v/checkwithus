import SwiftUI

@main struct MyApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    // A region event can relaunch the app in the background; the bank watcher must exist to hear it.
    init() { _ = BankWatcher.shared }

    var body: some Scene {
        WindowGroup {
            RootView()
                .modifier(AppTextSizeModifier())
                .environment(model)
                // Purple as text everywhere; filled buttons set the brand fill themselves.
                .tint(Color.link)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { model.keepPollingInBackground() }
            if phase == .active {
                // A background relaunch before first unlock cannot read the Keychain; try again once unlocked.
                if model.token == nil { model.token = TokenStore.load() }
                // resume() picks up a held payment that an offline launch could not load.
                Task { await model.resume(); await model.watch() }
                Task { await model.installScamNumbers() }
                Task { await BankWatcher.shared.refresh() }
            }
        }
    }
}
