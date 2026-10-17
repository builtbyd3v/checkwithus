"""Convert the trained Guard (ml/models/guard) to Core ML and check it matches PyTorch.

Usage: ml/.venv/bin/python -I ml/export_coreml.py
Writes ml/models/Guard.mlpackage (fp16) and ml/models/GuardInt8.mlpackage (8-bit weights), both gitignored.
The model outputs a calibrated scam probability (temperature baked in). The app compares it with the
threshold stored in the model metadata: code decides, the model only scores.
"""
import json
import time
from pathlib import Path

import coremltools as ct
import coremltools.optimize.coreml as cto
import numpy as np
import pandas as pd
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

ML = Path(__file__).resolve().parent
SRC = ML / "models/guard"
META = json.loads((SRC / "eval.json").read_text())
MAX_LEN = META["max_len"]


class Scorer(torch.nn.Module):
    """input_ids, attention_mask -> P(scam), with the val-fitted temperature applied."""

    def __init__(self, model, temperature):
        super().__init__()
        self.model, self.t = model, temperature

    def forward(self, input_ids, attention_mask):
        logits = self.model(input_ids=input_ids, attention_mask=attention_mask, return_dict=False)[0]
        return (logits / self.t).softmax(-1)[:, 1]


def encode(tok, texts):
    enc = tok(texts, truncation=True, max_length=MAX_LEN, padding="max_length", return_tensors="np")
    return enc["input_ids"].astype(np.int32), enc["attention_mask"].astype(np.int32)


def main():
    tok = AutoTokenizer.from_pretrained(SRC)
    model = AutoModelForSequenceClassification.from_pretrained(SRC, torchscript=True).eval()
    scorer = Scorer(model, META["temperature"]).eval()
    ids, mask = encode(tok, ["Your package is on hold. Pay $1.99 at https://usps-redeliver.info/r123"])
    traced = torch.jit.trace(scorer, (torch.tensor(ids, dtype=torch.long), torch.tensor(mask, dtype=torch.long)))

    fp16 = ct.convert(
        traced,
        inputs=[ct.TensorType(name="input_ids", shape=(1, MAX_LEN), dtype=np.int32),
                ct.TensorType(name="attention_mask", shape=(1, MAX_LEN), dtype=np.int32)],
        outputs=[ct.TensorType(name="scam_prob")],
        convert_to="mlprogram",
        compute_precision=ct.precision.FLOAT16,
        minimum_deployment_target=ct.target.iOS16,
    )
    int8 = cto.linear_quantize_weights(fp16, cto.OptimizationConfig(global_config=cto.OpLinearQuantizerConfig(mode="linear_symmetric")))

    test = pd.read_csv(ML / "data/test.csv")
    t_ids, t_mask = encode(tok, test.text.tolist())
    with torch.no_grad():
        ref = np.concatenate([scorer(torch.tensor(t_ids[i:i + 64], dtype=torch.long), torch.tensor(t_mask[i:i + 64], dtype=torch.long)).numpy()
                              for i in range(0, len(test), 64)])
    thr, y = META["threshold"], (test.label == "scam").values
    report = {}
    for name, m in (("Guard", fp16), ("GuardInt8", int8)):
        m.short_description = "checkwith.us Guard: P(scam) for one text message. Compare with metadata threshold."
        m.user_defined_metadata.update({"threshold": str(thr), "temperature": str(META["temperature"]),
                                        "max_len": str(MAX_LEN), "base": META["base"], "tokenizer": "bert-base-uncased WordPiece, vocab.txt"})
        path = ML / f"models/{name}.mlpackage"
        m.save(str(path))
        # Mac GPU (Metal) path crashes on this graph; CPU + Neural Engine is what the iPhone uses anyway.
        m = ct.models.MLModel(str(path), compute_units=ct.ComputeUnit.CPU_AND_NE)
        t0 = time.time()
        p = np.array([m.predict({"input_ids": t_ids[i:i + 1], "attention_mask": t_mask[i:i + 1]})["scam_prob"].item() for i in range(len(test))])
        ms = (time.time() - t0) / len(test) * 1000
        pred = p >= thr
        report[name] = {
            "size_mb": round(sum(f.stat().st_size for f in path.rglob("*") if f.is_file()) / 1e6, 1),
            "max_abs_diff_vs_torch": round(float(np.abs(p - ref).max()), 4),
            "decisions_changed_vs_torch": int((pred != (ref >= thr)).sum()),
            "scam_recall": round(float(pred[y].mean()), 4),
            "false_hold_rate": round(float(pred[~y].mean()), 4),
            "mac_ms_per_message": round(ms, 1),
        }
    (ML / "models/coreml_eval.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
