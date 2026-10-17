// Scores rules, model, and rules + model on a labeled CSV, through the same Swift code the phone runs.
// Usage: swift run -c release guard-eval <csv with text,label columns> [<GuardInt8.mlpackage>]
import CoreML
import Foundation
import GuardKit

/// Minimal RFC 4180 reader: quoted fields, "" escapes, commas and newlines inside quotes.
func readCSV(_ text: String) -> [[String]] {
    var rows: [[String]] = [], row: [String] = [], field = "", quoted = false
    var it = text.makeIterator()
    while let c = it.next() {
        if quoted {
            if c == "\"" {
                if let n = it.next() {
                    if n == "\"" { field.append("\"") } else {
                        quoted = false
                        if n == "," { row.append(field); field = "" } else if n == "\n" || n == "\r\n" { row.append(field); rows.append(row); row = []; field = "" } else { field.append(n) }
                    }
                } else { quoted = false }
            } else { field.append(c) }
        } else if c == "\"" { quoted = true }
        else if c == "," { row.append(field); field = "" }
        else if c == "\n" || c == "\r\n" { row.append(field); rows.append(row); row = []; field = "" }
        else { field.append(c) }
    }
    if !field.isEmpty || !row.isEmpty { row.append(field); rows.append(row) }
    return rows
}

func report(_ name: String, _ pred: [Bool], _ y: [Bool]) {
    let scams = y.filter { $0 }.count, legit = y.count - scams
    let caught = zip(pred, y).filter { $0 && $1 }.count
    let held = zip(pred, y).filter { $0 && !$1 }.count
    print(String(format: "%-14@ scam recall %5.1f%% (%d/%d)   false holds %4.1f%% (%d/%d)",
                 name as NSString, 100 * Double(caught) / Double(max(scams, 1)), caught, scams,
                 100 * Double(held) / Double(max(legit, 1)), held, legit))
}

let args = CommandLine.arguments
guard args.count >= 2 else { print("usage: guard-eval <csv> [<mlpackage>]"); exit(2) }
let rows = readCSV(try String(contentsOfFile: args[1], encoding: .utf8))
let header = rows[0]
guard let ti = header.firstIndex(of: "text"), let li = header.firstIndex(of: "label") else { print("need text,label columns"); exit(2) }
let data = rows.dropFirst().filter { $0.count == header.count }
let texts = data.map { $0[ti] }, y = data.map { $0[li] == "scam" }
print("\(texts.count) rows from \(args[1])")

let rules = ScamRules()
let ruleHits = texts.map { rules.hits($0) }
report("rules", ruleHits.map { !$0.isEmpty }, y)
for (hits, (text, isScam)) in zip(ruleHits, zip(texts, y)) where !isScam && !hits.isEmpty {
    print("  rule false hold [\(hits.map(\.id).joined(separator: ","))]: \(text.prefix(100))")
}

func evaluate(_ name: String, _ scorer: ScamScorer) throws {
    let guardModel = Guard(scorer: scorer)
    let start = Date()
    let verdicts = try texts.map { try guardModel.check($0) }
    let ms = Date().timeIntervalSince(start) * 1000 / Double(texts.count)
    report(name, verdicts.map { $0.probability >= guardModel.threshold }, y)
    report("rules + " + name, verdicts.map(\.isScam), y)
    print(String(format: "  %@: threshold %.4f, %.2f ms per text (score + rules)", name, guardModel.threshold, ms))
}

try evaluate("ngram", NGramScorer())
if args.count >= 3 {
    let config = MLModelConfiguration()
    config.computeUnits = .cpuAndNeuralEngine  // what the iPhone uses; the Mac GPU path crashes on this graph
    try evaluate("distilbert", CoreMLScorer(compiledModelURL: MLModel.compileModel(at: URL(fileURLWithPath: args[2])), configuration: config))
}
