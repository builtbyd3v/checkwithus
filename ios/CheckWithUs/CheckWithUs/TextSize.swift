import SwiftUI

/// Text size for this app only. "Same as iPhone" follows iOS (Settings > Display & Text Size); any other
/// choice changes only Check With Us, so the person's other apps keep their size.
enum AppTextSize: String, CaseIterable, Identifiable {
    case iPhone, regular, large, larger, largest

    var id: String { rawValue }

    var label: String {
        switch self {
        case .iPhone: "Same as iPhone"
        case .regular: "Regular"
        case .large: "Large"
        case .larger: "Larger"
        case .largest: "Largest"
        }
    }

    var size: DynamicTypeSize? {
        switch self {
        case .iPhone: nil
        case .regular: .large
        case .large: .xxxLarge
        case .larger: .accessibility2
        case .largest: .accessibility4
        }
    }
}

/// Applied once at the app root. Reads the iPhone's size from above, so "Same as iPhone" passes it through.
struct AppTextSizeModifier: ViewModifier {
    @AppStorage("textSize") private var choice = AppTextSize.iPhone
    @Environment(\.dynamicTypeSize) private var iPhoneSize

    func body(content: Content) -> some View {
        content.dynamicTypeSize(choice.size ?? iPhoneSize)
    }
}

/// One row per size, with a check on the current one. Used in both roles' settings.
struct TextSizeChoices: View {
    @AppStorage("textSize") private var choice = AppTextSize.iPhone

    var body: some View {
        ForEach(AppTextSize.allCases) { option in
            Button { choice = option } label: {
                HStack {
                    Text(option.label)
                    Spacer()
                    if option == choice { Image(systemName: "checkmark").accessibilityHidden(true) }
                }
                .frame(minHeight: 56)
                .contentShape(.rect)
            }
            .foregroundStyle(Color.primary)
            .accessibilityAddTraits(option == choice ? .isSelected : [])
        }
    }
}

/// The older adult's only setting, opened from Home. Nothing here leads to the family side.
struct TextSizeSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextSizeChoices()
                } footer: {
                    Text("This changes only this app. \"Same as iPhone\" uses your iPhone's text size.")
                }
                Section("Example") {
                    Text("You're safe. Your family is looking out for you.")
                }
            }
            .navigationTitle("Text size")
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}
