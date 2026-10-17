"""Train the tiny Guard for the Message Filter: hashed character n-grams + word n-grams, logistic regression.

Usage: ml/.venv/bin/python -I ml/train_ngram.py
Writes ios/GuardKit/Sources/GuardKit/Resources/guard_ngram.bin (float32 weights, little-endian),
guard_ngram.json (bias, threshold, sizes) and ml/models/ngram_eval.json.
The Swift scorer (NGramScorer.swift) must build exactly the same features: change both or neither.
Why: the Message Filter extension is killed above roughly 25-30 MB, so DistilBERT (67 MB) cannot run there.
"""
import json
import math
import re
from pathlib import Path

import numpy as np
import pandas as pd
import torch

ML = Path(__file__).resolve().parent
RES = ML.parent / "ios/GuardKit/Sources/GuardKit/Resources"
BITS = 18  # 262,144 buckets x 4 bytes = 1 MB
CHAR_NS = (3, 4, 5)
EPOCHS, BATCH, LR, WD = 12, 64, 0.05, 1e-6
TARGET_RECALL = 0.97  # same rule as train_guard.py
SEED = 42


def fnv1a(s):
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return h


def features(text):
    """Unique bucket ids. Swift twin: NGramScorer.features."""
    s = re.sub(r"\s+", " ", re.sub(r"[0-9]", "0", text.lower())).strip()
    grams = []
    padded = f" {s} "
    for n in CHAR_NS:
        grams += ["c:" + padded[i:i + n] for i in range(len(padded) - n + 1)]
    words = s.split(" ") if s else []
    grams += ["w:" + w for w in words]
    grams += ["b:" + a + " " + b for a, b in zip(words, words[1:])]
    mask = (1 << BITS) - 1
    return sorted({fnv1a(g) & mask for g in grams})


def bags(texts):
    ids, offsets, weights = [], [], []
    for t in texts:
        f = features(t)
        offsets.append(len(ids))
        ids += f
        weights += [1 / math.sqrt(len(f))] * len(f) if f else []
    return torch.tensor(ids, dtype=torch.long), torch.tensor(offsets, dtype=torch.long), torch.tensor(weights)


class Linear(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.w = torch.nn.EmbeddingBag(1 << BITS, 1, mode="sum")
        torch.nn.init.zeros_(self.w.weight)
        self.b = torch.nn.Parameter(torch.zeros(1))

    def forward(self, ids, offsets, weights):
        return self.w(ids, offsets, per_sample_weights=weights).squeeze(1) + self.b


def probs(model, texts):
    with torch.no_grad():
        return torch.sigmoid(model(*bags(texts))).numpy()


def metrics(p, df, thr):
    y, pred = (df.label == "scam").values, p >= thr
    by_type = {t: {"n": int((df.scam_type == t).sum()), "recall": round(float(pred[(df.scam_type == t).values].mean()), 3)}
               for t in sorted(df[df.label == "scam"].scam_type.unique())}
    return {"n": len(df), "accuracy": round(float((pred == y).mean()), 4), "scam_recall": round(float(pred[y].mean()), 4),
            "precision": round(float((pred & y).sum() / max(pred.sum(), 1)), 4),
            "false_hold_rate": round(float(pred[~y].mean()), 4), "recall_by_type": by_type}


def main():
    torch.manual_seed(SEED)
    tr, va, te, pr = (pd.read_csv(ML / f"data/{n}.csv") for n in ("train", "val", "test", "probe"))
    model = Linear()
    opt = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=WD)
    y = torch.tensor((tr.label == "scam").astype(float).values, dtype=torch.float32)
    texts = tr.text.tolist()
    g = torch.Generator().manual_seed(SEED)
    for epoch in range(EPOCHS):
        order = torch.randperm(len(texts), generator=g).tolist()
        total = 0.0
        for i in range(0, len(order), BATCH):
            idx = order[i:i + BATCH]
            loss = torch.nn.functional.binary_cross_entropy_with_logits(model(*bags([texts[j] for j in idx])), y[idx])
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        print(f"epoch {epoch + 1}: loss {total / len(texts):.4f}", flush=True)

    pv = probs(model, va.text.tolist())
    sv = np.sort(pv[(va.label == "scam").values])[::-1]
    thr = float(sv[math.ceil(TARGET_RECALL * len(sv)) - 1])
    result = {"bits": BITS, "char_ns": list(CHAR_NS), "threshold": round(thr, 6),
              "val_tuned_on": metrics(pv, va, thr), "test": metrics(probs(model, te.text.tolist()), te, thr),
              "probe_synthetic": metrics(probs(model, pr.text.tolist()), pr, thr)}

    w = model.w.weight.detach().squeeze(1).numpy().astype("<f4")
    (RES / "guard_ngram.bin").write_bytes(w.tobytes())
    (RES / "guard_ngram.json").write_text(json.dumps({"bits": BITS, "char_ns": list(CHAR_NS), "bias": float(model.b.item()),
                                                      "threshold": thr}, indent=2))
    (ML / "models/ngram_eval.json").write_text(json.dumps(result, indent=2))
    # Parity fixture for the Swift test: same texts must give the same scores.
    sample = pd.concat([te.sample(200, random_state=1), pr]).text.tolist() + ["", "Grandma 👵 send $500 now", "Café crème 123"]
    fixture = [{"text": t, "n": len(features(t)), "p": float(p)} for t, p in zip(sample, probs(model, sample))]
    (ML.parent / "ios/GuardKit/Tests/GuardKitTests/Resources/ngram_cases.json").write_text(json.dumps(fixture, ensure_ascii=False))
    for k in ("val_tuned_on", "test", "probe_synthetic"):
        m = result[k]
        print(k, {x: m[x] for x in ("n", "scam_recall", "precision", "false_hold_rate")}, {t: v["recall"] for t, v in m["recall_by_type"].items()})
    print(f"threshold {thr:.4f}, weights {w.nbytes / 1e6:.1f} MB, nonzero {int((w != 0).sum())}")


if __name__ == "__main__":
    main()
