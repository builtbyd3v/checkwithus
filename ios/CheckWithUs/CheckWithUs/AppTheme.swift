import SwiftUI
import UIKit

/// Native interpretation of docs/design/style-reference.md. Dynamic colors keep Dark Mode readable.
enum AppPalette {
    static let canvas = adaptive(0xf4f5f7, 0x10172a)
    static let surface = adaptive(0xffffff, 0x1c253b)
    static let panel = adaptive(0xeceef3, 0x28334b)
    static let ink = adaptive(0x202749, 0xf0f3fc)
    static let body = adaptive(0x444b60, 0xd0d7e8)
    static let muted = adaptive(0x656c80, 0xb4bdd2)
    static let line = adaptive(0xe2e5ec, 0x3a465f)
    // White labels exceed 4.5:1 in both modes; the proposed #337fe9 is too light.
    static let action = adaptive(0x2468c9, 0x2468c9)
    static let link = adaptive(0x1c519d, 0x9cc4ff)
    static let blueSoft = adaptive(0xe9f2ff, 0x233b60)
    static let positive = adaptive(0x176b50, 0x8ce8c5)
    static let warning = adaptive(0x8a4808, 0xffce8a)
    static let negative = adaptive(0xa3303d, 0xffa9b1)
    static let navy = Color(red: 32 / 255.0, green: 39 / 255.0, blue: 73 / 255.0)

    static func outcome(_ value: String) -> Color {
        switch value {
        case "waiting": warning
        case "sending", "sent": positive
        default: negative
        }
    }

    private static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
            let value = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((value >> 16) & 255) / 255,
                           green: CGFloat((value >> 8) & 255) / 255,
                           blue: CGFloat(value & 255) / 255, alpha: 1)
        })
    }
}

struct AppWordmark: View {
    var body: some View {
        HStack(spacing: 0) {
            Text("checkwith").foregroundStyle(AppPalette.ink)
            Text(".us").foregroundStyle(AppPalette.link)
        }
        .font(.headline.weight(.bold))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Check With Us")
    }
}

/// Retains the caller's Dynamic Type font and minimum target size.
struct AppActionButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    var prominent = true
    var destructive = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .foregroundStyle(prominent ? Color.white : destructive ? AppPalette.negative : AppPalette.link)
            .background(prominent ? AppPalette.action : AppPalette.surface, in: .rect(cornerRadius: 10))
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(prominent ? Color.clear : AppPalette.line, lineWidth: 1)
            }
            .contentShape(.rect(cornerRadius: 10))
            .brightness(configuration.isPressed ? -0.04 : 0)
            .opacity(enabled ? 1 : 0.45)
    }
}

struct AppStatusSymbol: View {
    let symbol: String
    let color: Color
    @ScaledMetric(relativeTo: .title) private var size: CGFloat = 68

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: min(size, 96), weight: .medium))
            .foregroundStyle(color)
            .padding(20)
            .background(color.opacity(0.08), in: .circle)
            .accessibilityHidden(true)
    }
}

extension View {
    func appCard(feature: Bool = false) -> some View {
        self.padding(feature ? 24 : 20)
            .background(AppPalette.surface, in: .rect(cornerRadius: feature ? 28 : 18))
            .overlay {
                RoundedRectangle(cornerRadius: feature ? 28 : 18)
                    .strokeBorder(AppPalette.line, lineWidth: 1)
            }
    }

    /// Apply to a List or Form; keeps native rows, separators and swipe actions.
    func appListSurface() -> some View {
        self.scrollContentBackground(.hidden)
            .background(AppPalette.canvas)
            .toolbarBackground(AppPalette.canvas, for: .navigationBar)
    }
}

#Preview("Palette and controls") {
    ScrollView {
        VStack(alignment: .leading, spacing: 24) {
            AppWordmark()
            VStack(alignment: .leading, spacing: 12) {
                Text("A little peace of mind.").font(.largeTitle.bold())
                Text("Clear reasons. Family decisions.").foregroundStyle(AppPalette.muted)
            }.appCard(feature: true)
            Button("Primary action") {}.frame(minHeight: 56).buttonStyle(AppActionButtonStyle())
            Button("Secondary action") {}.frame(minHeight: 56).buttonStyle(AppActionButtonStyle(prominent: false))
        }.padding(24)
    }
    .background(AppPalette.canvas)
    .foregroundStyle(AppPalette.ink)
    .fontDesign(.rounded)
}
