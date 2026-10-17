# checkwithus
## Eval table

Test set: 878 real texts (Mendeley, NCSU, UCI), no near-duplicates of training rows. Threshold set on val for 95% scam recall. Data: `ml/data/REPORT.md`.

| Model | Accuracy | Scam recall | False holds | Calibration (ECE) | iPhone latency |
|---|---|---|---|---|---|
| Guard: DistilBERT fine-tune (`ml/train_guard.py`) | 97.6% | 98.4% | 2.7% | 0.029 | not measured yet |
