// Message Filter extension: screens texts from unknown senders with GuardKit (rules + Core ML), all on the phone.
// Replaces the Xcode template's MessageFilterExtension.swift. Needs GuardKit linked and GuardInt8.mlpackage in this target.
import Foundation
import GuardKit
import IdentityLookup

final class MessageFilterExtension: ILMessageFilterExtension {}

extension MessageFilterExtension: ILMessageFilterQueryHandling {
    /// Loaded once per extension process. Xcode compiles GuardInt8.mlpackage into GuardInt8.mlmodelc in the bundle.
    private static let guardModel: Guard? = {
        guard let url = Bundle.main.url(forResource: "GuardInt8", withExtension: "mlmodelc") else {
            NSLog("Guard: GuardInt8.mlmodelc missing from the extension bundle")
            return nil
        }
        do { return try Guard(compiledModelURL: url) } catch {
            NSLog("Guard: model failed to load: %@", String(describing: error))
            return nil
        }
    }()

    func handle(_ queryRequest: ILMessageFilterQueryRequest, context: ILMessageFilterExtensionContext,
                completion: @escaping (ILMessageFilterQueryResponse) -> Void) {
        let response = ILMessageFilterQueryResponse()
        let start = Date()
        // ponytail: fail open. If the model is missing or errors, the text reaches the inbox rather than being lost.
        if let verdict = try? Self.guardModel?.check(queryRequest.messageBody ?? "") {
            response.action = verdict.isScam ? .junk : .none
            NSLog("Guard: scam=%d p=%.3f ms=%.0f reasons=%@", verdict.isScam ? 1 : 0, verdict.probability,
                  Date().timeIntervalSince(start) * 1000, verdict.reasons.joined(separator: " | "))
        } else {
            response.action = .none
        }
        completion(response)
    }
}
