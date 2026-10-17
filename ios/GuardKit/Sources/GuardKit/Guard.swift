import CoreML
import Foundation

public struct Verdict {
    /// Hold the text: the model score reached the threshold, or a rule fired.
    public let isScam: Bool
    /// Calibrated P(scam) from the model, 0 to 1.
    public let probability: Float
    /// Plain-words reasons for the family. Empty when the text looks fine.
    public let reasons: [String]
}

/// Anything that turns a text into P(scam) and knows its own threshold.
public protocol ScamScorer {
    var threshold: Float { get }
    func score(_ text: String) throws -> Float
}

/// Rules + a scorer. The model only scores; this code makes the call.
/// Message Filter: `Guard(scorer: try NGramScorer())`. Main app: `Guard(scorer: try CoreMLScorer(...))`.
public final class Guard {
    public let rules = ScamRules()
    public let scorer: ScamScorer
    public var threshold: Float { scorer.threshold }

    public init(scorer: ScamScorer) {
        self.scorer = scorer
    }

    public func check(_ text: String) throws -> Verdict {
        let p = try scorer.score(text)
        var reasons = rules.hits(text).map(\.reason)
        if p >= threshold {
            reasons.insert("Reads like a scam text (score \(Int((p * 100).rounded()))%)", at: 0)
        }
        return Verdict(isScam: !reasons.isEmpty, probability: p, reasons: reasons)
    }
}

/// DistilBERT through Core ML. Too big for the Message Filter (~67 MB); use it in the main app.
public final class CoreMLScorer: ScamScorer {
    public let threshold: Float
    private let model: MLModel
    private let tokenizer: WordPieceTokenizer

    /// `compiledModelURL`: the .mlmodelc Xcode builds from GuardInt8.mlpackage.
    public init(compiledModelURL: URL, configuration: MLModelConfiguration = MLModelConfiguration()) throws {
        model = try MLModel(contentsOf: compiledModelURL, configuration: configuration)
        let meta = model.modelDescription.metadata[.creatorDefinedKey] as? [String: String] ?? [:]
        guard let threshold = meta["threshold"].flatMap(Float.init) else { throw CocoaError(.coderValueNotFound) }
        self.threshold = threshold
        tokenizer = try WordPieceTokenizer(maxLength: meta["max_len"].flatMap(Int.init) ?? 128)
    }

    public func score(_ text: String) throws -> Float {
        let (ids, mask) = tokenizer.encode(text)
        let shape = [1, NSNumber(value: tokenizer.maxLength)]
        let idArray = try MLMultiArray(shape: shape, dataType: .int32)
        let maskArray = try MLMultiArray(shape: shape, dataType: .int32)
        for i in 0..<tokenizer.maxLength {
            idArray[i] = NSNumber(value: ids[i])
            maskArray[i] = NSNumber(value: mask[i])
        }
        let input = try MLDictionaryFeatureProvider(dictionary: ["input_ids": idArray, "attention_mask": maskArray])
        guard let out = try model.prediction(from: input).featureValue(for: "scam_prob")?.multiArrayValue else {
            throw CocoaError(.coderValueNotFound)
        }
        return out[0].floatValue
    }
}
