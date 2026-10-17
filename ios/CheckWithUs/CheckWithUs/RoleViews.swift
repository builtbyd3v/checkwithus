import SwiftUI

/// Who uses this phone: "protected" (the older adult) or "family". Chosen once, changed in Settings.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("role") private var role = ""
    @State private var settings = false

    var body: some View {
        switch role {
        case "family":
            FamilyRootView()
        case "protected":
            ContentView()
                // A bar above the page, not an overlay, so very large text never runs under the gear.
                .safeAreaInset(edge: .top, spacing: 0) {
                    // Only on the home and connect screens, so it never sits on top of a payment
                    // or the bank permission step (#25).
                    if model.token == nil || (model.screen == .home && !BankWatcher.shared.needsPermission) {
                        HStack {
                            Spacer()
                            Button { settings = true } label: {
                                Image(systemName: "gearshape.fill").font(.title2).frame(width: 56, height: 56)
                            }
                            .tint(AppPalette.link)
                            .accessibilityLabel("Settings")
                            .padding(.trailing, 8)
                        }
                        .background(AppPalette.canvas)
                    }
                }
                .sheet(isPresented: $settings) { ProtectedSettingsView() }
                #if DEBUG
                .onAppear { if UserDefaults.standard.string(forKey: "preview") == "settings" { settings = true } }
                #endif
        default:
            RolePickerView()
                // A phone that was paired before the picker existed belongs to the older adult.
                .onAppear { if UserDefaults.standard.object(forKey: "role") == nil, model.token != nil { role = "protected" } }
        }
    }
}

struct RolePickerView: View {
    @AppStorage("role") private var role = ""

    var body: some View {
        Page {
            AppStatusSymbol(symbol: "person.2.fill", color: AppPalette.link)
            Text("Who uses this phone?")
                .font(.largeTitle.bold())
            Text("You can change this later in Settings.")
                .font(.title2)
        } action: {
            // Any role choice starts the family side signed out (see FamilyAuth.forget).
            BigButton("I'm the one being protected", symbol: "checkmark.shield.fill") { FamilyAuth.forget(); role = "protected" }
            BigButton("I'm family", symbol: "person.2.fill", prominent: false) { FamilyAuth.forget(); role = "family" }
        }
    }
}

/// Settings for the older adult: big text, one choice.
struct ProtectedSettingsView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SwitchRoleButton()
                        .font(.title3)
                        .frame(minHeight: 56)
                } footer: {
                    // Primary color: the gray footer text is under 4.5:1 on the grouped background.
                    Text("Only do this if a family member will use this phone.").font(.body).foregroundStyle(AppPalette.body)
                }
            }
            .appListSurface()
            .navigationTitle("Settings")
            .toolbar { Button("Done") { dismiss() }.font(.title3.weight(.semibold)) }
        }
    }
}

struct SwitchRoleButton: View {
    @AppStorage("role") private var role = ""

    var body: some View {
        Button("Change who uses this phone") {
            FamilyAuth.forget()
            role = ""
        }
    }
}
