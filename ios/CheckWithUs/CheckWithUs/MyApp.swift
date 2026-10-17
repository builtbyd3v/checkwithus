import SwiftUI

@main struct MyApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { model.keepPollingInBackground() }
            if phase == .active {
                // resume() picks up a held payment that an offline launch could not load.
                Task { await model.resume(); await model.watch() }
                Task { await model.installScamNumbers() }
            }
        }
    }
}
