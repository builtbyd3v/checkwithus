import CallKit
import Foundation

/// Labels incoming calls from known scam numbers "Possible scam" on the ring screen. The list comes from the
/// App Group file the app writes; nothing leaves the phone.
final class CallDirectoryHandler: CXCallDirectoryProvider {
    override func beginRequest(with context: CXCallDirectoryExtensionContext) {
        // The list is small, so every reload replaces it whole instead of tracking additions and removals.
        if context.isIncremental { context.removeAllIdentificationEntries() }
        for number in ScamNumbers.read() {
            context.addIdentificationEntry(withNextSequentialPhoneNumber: number, label: "Possible scam")
        }
        context.completeRequest()
    }
}
