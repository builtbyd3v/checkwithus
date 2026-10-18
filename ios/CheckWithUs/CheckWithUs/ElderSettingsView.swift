import SwiftUI

/// The older adult's Settings, opened from the gear on Home: text size, light or dark, who the family is,
/// and how to unpair. Nothing here leads to the family side, and nothing here can unpair the phone.
struct ElderSettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    /// Same key and raw values as the family side; MyApp applies it to the whole app.
    @AppStorage("appearance") private var appearance = "system"
    @State private var family: Load = .loading

    private enum Load { case loading, loaded([API.FamilyMember]), failed }

    private static let appearances = [("system", "Same as iPhone"), ("light", "Light"), ("dark", "Dark")]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextSizeChoices()
                } header: {
                    header("Text size")
                } footer: {
                    Text("This changes only this app. \"Same as iPhone\" uses your iPhone's text size.")
                        .font(.brand(.body))
                }

                Section {
                    ForEach(Self.appearances, id: \.0) { value, label in
                        Button { appearance = value } label: {
                            HStack {
                                Text(label)
                                Spacer()
                                if appearance == value { Image(systemName: "checkmark").accessibilityHidden(true) }
                            }
                            .frame(minHeight: 56)
                            .contentShape(.rect)
                        }
                        .foregroundStyle(Color.primary)
                        .accessibilityAddTraits(appearance == value ? .isSelected : [])
                    }
                } header: {
                    header("Light or dark")
                }

                Section {
                    switch family {
                    case .loading:
                        HStack(spacing: 12) {
                            ProgressView()
                            Text("Loading your family")
                        }
                        .frame(minHeight: 56)
                    case .failed:
                        Text("Could not load your family. Try again later.")
                            .foregroundStyle(Color.errorText)
                            .frame(minHeight: 56, alignment: .leading)
                    case .loaded(let members) where members.isEmpty:
                        Text("No one yet.").frame(minHeight: 56, alignment: .leading)
                    case .loaded(let members):
                        ForEach(members, id: \.self) { member in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(member.displayName).font(.brand(.title3, weight: .semibold))
                                Text(member.role == "approver" ? "Can approve" : "Can see")
                                    .foregroundStyle(Color.secondaryText)
                            }
                            .frame(minHeight: 56, alignment: .leading)
                            .accessibilityElement(children: .combine)
                        }
                    }
                } header: {
                    header("Your family")
                }

                Section {
                    // The family approves an unpair from their app or the dashboard. No way out on this phone.
                    Text("To unpair this phone, ask your family. They can do it from their app.")
                        .frame(minHeight: 56, alignment: .leading)
                } header: {
                    header("Sign out")
                }
            }
            .font(.brand(.title3))
            .navigationTitle("Settings")
            .safeAreaInset(edge: .bottom) {
                BigButton("Done", symbol: "checkmark") { dismiss() }
                    .padding(.horizontal, 24)
                    .padding(.vertical, 8)
                    // Same ground as the list, so the bar reads as part of the sheet.
                    .background(Color(uiColor: .systemGroupedBackground))
            }
        }
        .task { await load() }
    }

    private func header(_ title: String) -> some View {
        Text(title)
            .font(.display(.title2))
            .foregroundStyle(Color.ink)
            .textCase(nil)
            .accessibilityAddTraits(.isHeader)
    }

    private func load() async {
        do { family = .loaded(try await model.family()) } catch { family = .failed }
    }
}
