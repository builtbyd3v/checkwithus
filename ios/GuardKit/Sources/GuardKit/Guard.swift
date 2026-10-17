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

/// Rules + DistilBERT. The model only scores; this code makes the call using the threshold stored in the model.
public final class Guard {
    public let threshold: Float
    public let rules = ScamRules()
    private let model: MLModel
    private let tokenizer: WordPieceTokenizer

    /// `compiledModelURL`: the .mlmodelc Xcode builds from GuardInt8.mlpackage (Bundle.main.url(forResource: "GuardInt8", withExtension: "mlmodelc")).
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

    public func check(_ text: String) throws -> Verdict {
        let p = try score(text)
        var reasons = rules.hits(text).map(\.reason)
        if p >= threshold {
            reasons.insert("Reads like a scam text (score \(Int((p * 100).rounded()))%)", at: 0)
        }
        return Verdict(isScam: !reasons.isEmpty, probability: p, reasons: reasons)
    }
}
