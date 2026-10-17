//
//  MessageFilterExtension.swift
//  MessageFilter
//
//  Screens texts from unknown senders with GuardKit (9 rules + tiny n-gram model), all on the phone.
//  The extension is killed above roughly 25-30 MB (measured on iOS 26), so DistilBERT (67 MB) cannot run here.
//

import Foundation
import GuardKit
import IdentityLookup
import os

final class MessageFilterExtension: ILMessageFilterExtension {}

extension MessageFilterExtension: ILMessageFilterQueryHandling, ILMessageFilterCapabilitiesQueryHandling {
    private static let log = Logger(subsystem: "us.checkwith.MessageFilter", category: "Guard")

    /// Fallback when the model fails to load; needs no weights.
    private static let rules = ScamRules()

    /// Loaded once per extension process. Weights are memory-mapped (about 1 MB).
    private static let guardModel: Guard? = {
        do { return Guard(scorer: try NGramScorer()) } catch {
            log.error("Guard: model failed to load: \(String(describing: error), privacy: .public)")
            return nil
        }
    }()

    func handle(_ capabilitiesQueryRequest: ILMessageFilterCapabilitiesQueryRequest, context: ILMessageFilterExtensionContext,
                completion: @escaping (ILMessageFilterCapabilitiesQueryResponse) -> Void) {
        // No transactional or promotional sub-folders: we only decide junk or allow.
        completion(ILMessageFilterCapabilitiesQueryResponse())
    }

    func handle(_ queryRequest: ILMessageFilterQueryRequest, context: ILMessageFilterExtensionContext,
                completion: @escaping (ILMessageFilterQueryResponse) -> Void) {
        let response = ILMessageFilterQueryResponse()
        let start = Date()
        let text = queryRequest.messageBody ?? ""
        // If the model is missing or errors, the rules still run: a rule hit goes to Junk, anything else reaches the inbox.
        if let verdict = try? Self.guardModel?.check(text) {
            response.action = verdict.isScam ? .junk : .allow
            let ms = Date().timeIntervalSince(start) * 1000
            // Score, timing, memory and reasons are public so the device log shows them; the message text is never logged.
            Self.log.notice("Guard: scam=\(verdict.isScam, privacy: .public) p=\(verdict.probability, format: .fixed(precision: 3), privacy: .public) ms=\(ms, format: .fixed(precision: 1), privacy: .public) footprintMB=\(Self.footprintMB(), format: .fixed(precision: 1), privacy: .public) reasons=\(verdict.reasons.joined(separator: " | "), privacy: .public)")
        } else {
            let hits = Self.rules.hits(text)
            response.action = hits.isEmpty ? .allow : .junk
            Self.log.error("Guard: model unavailable, rules only: scam=\(!hits.isEmpty, privacy: .public) reasons=\(hits.map(\.reason).joined(separator: " | "), privacy: .public)")
        }
        completion(response)
    }

    private static func footprintMB() -> Double {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
        let kr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count) }
        }
        return kr == KERN_SUCCESS ? Double(info.phys_footprint) / 1_048_576 : -1
    }
}
