# checkwithus
## Eval table

Test set: real texts only (Mendeley, NCSU, UCI), no near-duplicates of training rows. Threshold set on val. Probe: 40 held-out synthetic toll and investment texts (no real ones exist). Data: `ml/data/REPORT.md`.

| Model | Test n | Accuracy | Scam recall | False holds | ECE | Delivery + toll recall (test / probe) | Investment recall (test / probe) | iPhone latency |
|---|---|---|---|---|---|---|---|---|
| Guard v1: DistilBERT, val target 95% | 878 | 97.6% | 98.4% | 2.7% | 0.029 | 100% / n/a | n/a | not measured |
| Guard v2: + toll and investment data, val target 97% | 884 | 97.4% | 93.9% | 1.3% | 0.014 | 88.6% / 100% | 100% (6) / 13% | not measured |
| Guard v2, Core ML 8-bit (`GuardInt8.mlpackage`, 67 MB) | 884 | | 94.0% | 1.1% | | | | not measured (Mac: 1.3 ms) |
| Rules only (`ios/GuardKit/ScamRules.swift`, 9 rules) | 884 | | 2.4% | 0.0% | | | / 47% | |
| Rules + Core ML model, Swift end to end (`swift run guard-eval`) | 884 | | 94.0% | 1.1% | | | / 57% | not measured (Mac: 1.4 ms) |
| **Guard tiny: char + word n-grams, logistic regression, 1 MB (runs in the Message Filter)** | 884 | | 96.0% | 2.4% | | 100% / 100% | 100% (6) / 13% | **11 ms, 2.6 MB on iPhone 18 Pro Max** |

v1 and v2 use slightly different test sets (the data changed), so compare with care. Legit "Toll Free" texts in test held by v2: 0 of 3. Rules hold 0 of 6,382 legit texts across train, val and test. The Message Filter extension is killed above roughly 25-30 MB (measured with a probe on iOS 26), so DistilBERT (67 MB) runs only in the main app; the tiny model runs in the filter.
