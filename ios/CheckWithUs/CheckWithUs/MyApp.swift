import SwiftUI

@main struct MyApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    // A region event can relaunch the app in the background; the bank watcher must exist to hear it.
    init() { _ = BankWatcher.shared }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(AppPalette.link)
                .foregroundStyle(AppPalette.ink)
                .fontDesign(.rounded)
                .environment(\.defaultMinListRowHeight, 56)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { model.keepPollingInBackground() }
            if phase == .active {
                // resume() picks up a held payment that an offline launch could not load.
                Task { await model.resume(); await model.watch() }
                Task { await model.installScamNumbers() }
                Task { await BankWatcher.shared.refresh() }
            }
        }
    }
}
