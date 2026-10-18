import GuardKit
import SwiftUI

/// A family code as 8 boxes, 4, a drawn dash, 4. One hidden text field sits behind the boxes, so VoiceOver
/// hears one field and Voice Control and Dictation still type into it. ShortCode cleans every edit:
/// uppercase, look-alikes mapped, other characters dropped, never more than 8.
struct CodeEntryField: View {
    let label: String
    /// The cleaned characters, no dash. `ShortCode.canonical(code)` is the XXXX-XXXX to send.
    @Binding var code: String
    /// Older adult look: big boxes. Off for the family app: calmer and smaller.
    var large = true
    /// Return only submits once all 8 are in.
    var onSubmit: () -> Void = {}

    @FocusState private var focused: Bool
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .largeTitle) private var bigHeight = 64
    @ScaledMetric(relativeTo: .title2) private var smallHeight = 48

    var body: some View {
        Group {
            // Very large text: two rows of 4, no dash, so the boxes never run off the screen.
            if typeSize.isAccessibilitySize {
                VStack(spacing: 8) { row(0..<4); row(4..<8) }
            } else {
                HStack(spacing: 6) {
                    row(0..<4)
                    Text("-").foregroundStyle(Color.secondaryText)
                    row(4..<8)
                }
            }
        }
        .font(large ? .brand(.largeTitle, weight: .bold) : .brand(.title2, weight: .bold))
        .accessibilityHidden(true)
        .overlay {
            // An empty prompt: the label is for VoiceOver and Voice Control, never drawn over the boxes.
            TextField(label, text: $code, prompt: Text(""))
                .focused($focused)
                .keyboardType(.asciiCapable)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .onSubmit { if ShortCode.canonical(code) != nil { onSubmit() } }
                // Invisible text and caret: the boxes show what was typed.
                .foregroundStyle(.clear)
                .tint(.clear)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityLabel("\(label), \(ShortCode.length) characters")
                .accessibilityValue("\(code.count) entered")
                .accessibilityInputLabels([label, "Code"])
        }
        .contentShape(.rect)
        .onTapGesture { focused = true }
        .onChange(of: code) { old, new in
            let fixed = ShortCode.next(previous: old, edited: new)
            if fixed != new { code = fixed }
        }
    }

    private func row(_ slots: Range<Int>) -> some View {
        let chars = Array(code)
        let radius: CGFloat = large ? 20 : 12
        return HStack(spacing: 6) {
            ForEach(slots, id: \.self) { i in
                let active = focused && i == min(chars.count, ShortCode.length - 1)
                Text(i < chars.count ? String(chars[i]) : " ")
                    .foregroundStyle(Color.ink)
                    .minimumScaleFactor(0.5)
                    .frame(maxWidth: .infinity, minHeight: large ? bigHeight : smallHeight)
                    .background(Color.surface, in: .rect(cornerRadius: radius))
                    .overlay { RoundedRectangle(cornerRadius: radius).strokeBorder(Color.action, lineWidth: 3).opacity(active ? 1 : 0) }
            }
        }
    }
}
