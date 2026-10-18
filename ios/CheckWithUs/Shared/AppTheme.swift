import SwiftUI

/// The purple and yellow brand look, in one place. Shared, so the lock-screen card uses the same status colors.
/// ponytail: temporary theme for device tests; values come from the design mockups (ios-older.html, ios-family.html).
/// Contrast (light / dark / Increase Contrast): ink 15:1+ on every surface and field, muted 6.6:1+, white on brand 5.0:1
/// (7.6:1 with Increase Contrast), link 5.6:1+, warning and error text 5.5:1+, status icons 3.7:1+ on their fields.
/// Sun is a fill only, never text: ink on it is 10.9:1 in every mode.
extension Color {
    /// Page ground.
    static let bg = theme(0xFDFCFA, 0x100C13)
    /// Secondary buttons, rows, text boxes. Surfaces differ by tone only; Increase Contrast deepens the tone.
    static let surface = theme(0xF1EDF4, 0x211B26, hc: (0xE4DCEA, 0x2E2634))
    /// All main text.
    static let ink = theme(0x1B1420, 0xF7F3F9, hc: (0x1B1420, 0xFFFFFF))
    /// Main button fill, with white text. Replaces the old blue.
    static let action = theme(0xA62FEA, 0xA62FEA, hc: (0x7F1ABA, 0x7F1ABA))
    /// Purple as text: Back, More below, text-only buttons, the app tint.
    static let link = theme(0x8E1FD0, 0xD3A2FF, hc: (0x6A12A0, 0xE6CCFF))
    /// The older adult's color, as in the logo. Fill only; text on it is `onSun`.
    static let sun = Color(red: 0xFB / 255, green: 0xC0 / 255, blue: 0x2D / 255)
    static let onSun = Color(red: 0x1B / 255, green: 0x14 / 255, blue: 0x20 / 255)
    /// Lock-screen card background.
    static let card = theme(0xFFFFFF, 0x241E29)

    /// Status icons, and the whole-page fields behind them.
    static let safe = theme(0x1E8E3E, 0x4CC46E, hc: (0x146C2E, 0x7FE09A))
    static let safeField = theme(0xE4F3E8, 0x10261A)
    static let pause = theme(0xC25E00, 0xFF9F2E, hc: (0x8A4B00, 0xFFC27A))
    static let pauseField = theme(0xFDEDD6, 0x2C1C08)
    static let stop = theme(0xC62828, 0xFF6B5E, hc: (0xB3261E, 0xFF9C93))
    static let stopField = theme(0xFCE6E3, 0x33130F)

    /// Old names kept, new values. Text colors at 4.5:1 or better on bg, rows and their own field.
    static let warningText = theme(0x8A4B00, 0xFFC27A, hc: (0x6B3A00, 0xFFD9A8))
    static let errorText = theme(0xB3261E, 0xFF9C93, hc: (0x8C1D17, 0xFFC4BE))
    static let secondaryText = theme(0x5A5062, 0xBDB3C4, hc: (0x3F3746, 0xDCD4E2))
}

/// Light and dark hex values, plus optional Increase Contrast values (Settings > Accessibility > Display & Text Size).
nonisolated private func theme(_ light: UInt32, _ dark: UInt32, hc: (UInt32, UInt32)? = nil) -> Color {
    Color(UIColor { traits in
        let high = traits.accessibilityContrast == .high
        let hex = traits.userInterfaceStyle == .dark ? (high ? hc?.1 ?? dark : dark) : (high ? hc?.0 ?? light : light)
        return UIColor(red: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

/// Brand type: Figtree for text, Gabarito for titles, the same pair as the web. Each one scales with
/// Dynamic Type (and the app's own Text size) like the system style it stands in for. The fonts ship in
/// the main app only; anywhere else (the widget) Font.custom falls back to the system font.
extension Font {
    static func brand(_ style: TextStyle, weight: Weight = .regular) -> Font {
        let name = switch weight {
        case .heavy, .black: "Figtree-ExtraBold"
        case .bold: "Figtree-Bold"
        case .medium, .semibold: "Figtree-SemiBold"
        default: "Figtree-Regular"
        }
        return .custom(name, size: style.baseSize, relativeTo: style)
    }

    static func display(_ style: TextStyle, weight: Weight = .heavy) -> Font {
        .custom(weight == .semibold || weight == .medium ? "Gabarito-SemiBold" : "Gabarito-ExtraBold", size: style.baseSize, relativeTo: style)
    }
}

private extension Font.TextStyle {
    /// Point sizes at the default text size (Large), from Apple's type ramp.
    var baseSize: CGFloat {
        switch self {
        case .largeTitle: 34
        case .title: 28
        case .title2: 22
        case .title3: 20
        case .callout: 16
        case .subheadline: 15
        case .footnote: 13
        case .caption: 12
        case .caption2: 11
        default: 17
        }
    }
}
