import ActivityKit
import SwiftUI
import WidgetKit

/// The lock-screen card: "Paused, waiting for family" while a payment is held, then the family's answer.
@main struct SafeCardBundle: WidgetBundle {
    var body: some Widget { SafeCard() }
}

struct SafeCard: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PaymentActivity.self) { context in
            let outcome = context.state.outcome
            HStack(spacing: 16) {
                Image(systemName: OutcomeText.symbol(outcome))
                    .font(.system(size: 44))
                    .foregroundStyle(OutcomeText.color(outcome))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(OutcomeText.headline(outcome)).font(.title3.bold())
                    Text("\(context.attributes.amount) to \(context.attributes.payee)").font(.body)
                    Text(OutcomeText.detail(outcome)).font(.callout).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding()
            .accessibilityElement(children: .combine)
        } dynamicIsland: { context in
            let outcome = context.state.outcome
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: OutcomeText.symbol(outcome)).font(.largeTitle).foregroundStyle(OutcomeText.color(outcome))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading) {
                        Text(OutcomeText.headline(outcome)).font(.title3.bold())
                        Text("\(context.attributes.amount) to \(context.attributes.payee)")
                    }
                }
            } compactLeading: {
                Image(systemName: OutcomeText.symbol(outcome)).foregroundStyle(OutcomeText.color(outcome))
            } compactTrailing: {
                Text(context.attributes.amount)
            } minimal: {
                Image(systemName: OutcomeText.symbol(outcome)).foregroundStyle(OutcomeText.color(outcome))
            }
        }
    }
}
