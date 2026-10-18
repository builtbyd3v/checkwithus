import SwiftUI

/// Who uses this phone: "protected" (the older adult) or "family". A paired phone is the older adult's, whatever
/// the role says, so a scammer cannot talk them into the family side. Only the family can release it (unpair).
struct RootView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("role") private var role = ""

    var body: some View {
        if model.token != nil || role == "protected" {
            ContentView()
                // Figtree for any text without its own font. Screens set Font.brand / Font.display themselves.
                .font(.brand(.body))
                // A bar above the page, not an overlay, so very large text never runs under it.
                .safeAreaInset(edge: .top, spacing: 0) {
                    // Before pairing only: back to the first screen. Once paired there is no way out on this phone.
                    if model.token == nil {
                        HStack {
                            Button { role = "" } label: {
                                Label("Back", systemImage: "chevron.left")
                                    .font(.brand(.title2, weight: .semibold))
                                    .frame(minHeight: 56)
                            }
                            .modifier(ShapeWhenAsked())
                            .padding(.leading, 24)
                            Spacer()
                            TextSizeButton()
                        }
                        .background(Color.bg)
                    }
                }
        } else if role == "family" {
            FamilyRootView()
        } else {
            RolePickerView()
                .font(.brand(.body))
        }
    }
}

struct RolePickerView: View {
    @AppStorage("role") private var role = ""

    var body: some View {
        // The same first screen for both roles: centered while it fits, it still scrolls at very large text.
        Page(centered: true) {
            VStack(spacing: 0) {
                AppIconTile(size: 120)
                Text("Welcome to Check With Us")
                    .font(.display(.largeTitle))
                    .padding(.top, 32)
                Text("Did your family give you a code? Tap the top button.")
                    .font(.brand(.title2))
                    .frame(maxWidth: 320)
                    .padding(.top, 14)
            }
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
        } action: {
            // Any role choice starts the family side signed out (see FamilyAuth.forget).
            BigButton("I have a code from my family", sun: true) { FamilyAuth.forget(); role = "protected" }
                .accessibilityInputLabels(["I have a code", "Code", "I have a code from my family"])
            BigButton("I'm family: Sign in") { FamilyAuth.forget(); role = "family" }
                .accessibilityInputLabels(["Sign in", "I'm family", "Family"])
        }
    }
}

/// Family side only: a paired phone never shows the family side (see RootView).
struct SwitchRoleButton: View {
    @AppStorage("role") private var role = ""

    var body: some View {
        Button("Change who uses this phone") {
            FamilyAuth.forget()
            role = ""
        }
    }
}
