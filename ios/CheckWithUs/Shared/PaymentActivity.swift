import ActivityKit
import SwiftUI

/// The lock-screen card for a held payment. Shared by the app (starts and updates it) and SafeCard (draws it).
nonisolated struct PaymentActivity: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// The server's device outcome: waiting, sending, sent, blocked_by_family, blocked_no_answer, failed.
        var outcome: String
    }

    var amount: String
    var payee: String
}

/// Plain words for each outcome, used by the app screens and the lock-screen card alike.
enum OutcomeText {
    static func headline(_ outcome: String) -> String {
        switch outcome {
        case "waiting": "Paused, waiting for family"
        case "sending": "Your family said yes"
        case "sent": "Paid"
        case "blocked_by_family": "Stopped. Your family said no."
        case "blocked_no_answer": "Stopped. No one answered in time."
        default: "It did not go through"
        }
    }

    static func detail(_ outcome: String) -> String {
        switch outcome {
        case "waiting": "Your money is safe. Your family will call you."
        case "sending": "Sending it now."
        case "sent": "All done."
        case "blocked_by_family", "blocked_no_answer": "Your money is safe. Nothing was sent."
        default: "Nothing was sent. Ask your family for help."
        }
    }

    static func symbol(_ outcome: String) -> String {
        switch outcome {
        case "waiting": "pause.circle.fill"
        case "sending", "sent": "checkmark.circle.fill"
        default: "hand.raised.circle.fill"
        }
    }

    static func color(_ outcome: String) -> Color {
        switch outcome {
        case "waiting": .orange
        case "sending", "sent": .green
        default: .red
        }
    }
}
