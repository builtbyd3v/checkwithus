"""Fine-tune DistilBERT as the Guard scam classifier.

Usage: ml/.venv/bin/python -I ml/train_guard.py
Reads ml/data/{train,val,test}.csv. Writes ml/models/guard/ (weights gitignored) and eval.json.
Temperature and threshold come from val only. Test is scored once, at the end.
"""
import json
import math
import time
from pathlib import Path

import pandas as pd
import torch
from torch.nn.functional import cross_entropy
from transformers import AutoModelForSequenceClassification, AutoTokenizer

ML = Path(__file__).resolve().parent
OUT = ML / "models/guard"
BASE = "distilbert-base-uncased"
MAX_LEN = 128
EPOCHS = 2
BATCH = 32
LR = 5e-5
TARGET_RECALL = 0.95  # IDEAS.md: threshold for 95%+ scam recall
SEED = 42

torch.manual_seed(SEED)
DEV = "mps" if torch.backends.mps.is_available() else "cpu"
tok = AutoTokenizer.from_pretrained(BASE)


def load(name):
    df = pd.read_csv(ML / f"data/{name}.csv")
    return df, torch.tensor((df.label == "scam").astype(int).values)


def batches(texts, n=BATCH):
    for i in range(0, len(texts), n):
        yield i, tok(texts[i:i + n], truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt").to(DEV)


@torch.no_grad()
def logits_of(model, texts):
    model.eval()
    return torch.cat([model(**b).logits.float().cpu() for _, b in batches(texts, 128)])


def train(model, texts, y):
    opt = torch.optim.AdamW(model.parameters(), lr=LR)
    per_epoch = math.ceil(len(texts) / BATCH)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: 1 - s / (EPOCHS * per_epoch))
    g = torch.Generator().manual_seed(SEED)
    for epoch in range(EPOCHS):
        model.train()
        order = torch.randperm(len(texts), generator=g).tolist()
        shuffled, ys = [texts[i] for i in order], y[order]
        t0, total = time.time(), 0.0
        for i, b in batches(shuffled):
            loss = cross_entropy(model(**b).logits, ys[i:i + BATCH].to(DEV))
            loss.backward()
            opt.step()
            sched.step()
            opt.zero_grad()
            total += loss.item()
        print(f"epoch {epoch + 1}: loss {total / per_epoch:.4f} ({time.time() - t0:.0f}s)", flush=True)


def fit_temperature(logits, y):
    t = torch.ones(1, requires_grad=True)
    opt = torch.optim.LBFGS([t], lr=0.1, max_iter=200)

    def step():
        opt.zero_grad()
        loss = cross_entropy(logits / t, y)
        loss.backward()
        return loss

    opt.step(step)
    return t.item()


def ece(p, y, bins=10):
    idx = (p * bins).long().clamp(max=bins - 1)
    return sum((idx == b).float().mean().item() * abs(p[idx == b].mean() - y[idx == b].float().mean()).item()
               for b in range(bins) if (idx == b).any())


def metrics(p, y, thr, df):
    pred, scam = p >= thr, y == 1
    by_type = {}
    for t in sorted(df[df.label == "scam"].scam_type.unique()):
        mask = torch.tensor((df.scam_type == t).values)
        by_type[t] = {"n": int(mask.sum()), "recall": round(pred[mask].float().mean().item(), 3)}
    return {
        "n": len(y),
        "accuracy": round((pred == scam).float().mean().item(), 4),
        "scam_recall": round(pred[scam].float().mean().item(), 4),
        "precision": round((pred & scam).sum().item() / max(pred.sum().item(), 1), 4),
        "false_hold_rate": round(pred[~scam].float().mean().item(), 4),
        "ece": round(ece(p, y), 4),
        "recall_by_type": by_type,
    }


def main():
    tr, ytr = load("train")
    va, yva = load("val")
    te, yte = load("test")
    print(f"device {DEV}; train {len(tr)}, val {len(va)}, test {len(te)}", flush=True)

    model = AutoModelForSequenceClassification.from_pretrained(BASE, num_labels=2).to(DEV)
    train(model, tr.text.tolist(), ytr)

    lv = logits_of(model, va.text.tolist())
    temp = fit_temperature(lv, yva)
    pv = (lv / temp).softmax(1)[:, 1]
    # Highest threshold that still catches TARGET_RECALL of val scams.
    k = math.ceil(TARGET_RECALL * int(yva.sum()))
    thr = pv[yva == 1].sort(descending=True).values[k - 1].item()
    pt = (logits_of(model, te.text.tolist()) / temp).softmax(1)[:, 1]

    result = {"base": BASE, "epochs": EPOCHS, "max_len": MAX_LEN, "temperature": round(temp, 4), "threshold": round(thr, 4),
              "val_tuned_on": metrics(pv, yva, thr, va), "test": metrics(pt, yte, thr, te)}
    OUT.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(OUT)
    tok.save_pretrained(OUT)
    (OUT / "eval.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
