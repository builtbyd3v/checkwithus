import SwiftUI

@main struct MyApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(model)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { model.keepPollingInBackground() }
            if phase == .active { Task { await model.watch() } }
        }
    }
}
