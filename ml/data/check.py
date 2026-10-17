"""Done-check: load every CSV, print counts, assert the split rules.

Usage: ml/.venv/bin/python -I ml/data/check.py
"""
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

D = Path(__file__).resolve().parent
TYPES = {"impostor", "tech_support", "gift_card", "prize", "romance", "grandparent", "bank_alert", "delivery", "investment", "other", "none"}

full = pd.read_csv(D / "scams.csv")
parts = {n: pd.read_csv(D / f"{n}.csv") for n in ("train", "val", "test")}

for name, df in {"scams": full, **parts}.items():
    assert list(df.columns) == ["text", "label", "scam_type", "source"], name
    assert set(df.label) <= {"scam", "legit"} and set(df.scam_type) <= TYPES, name
    assert df.text.notna().all() and not df.text.duplicated().any(), name
    print(f"\n== {name}: {len(df)} rows")
    print(df.label.value_counts().to_string())

print("\n== scams.csv by source x label")
print(pd.crosstab(full.source, full.label, margins=True).to_string())
print("\n== scams.csv by scam_type x label")
print(pd.crosstab(full.scam_type, full.label, margins=True).to_string())
print("\n== split sizes by scam_type")
print(pd.DataFrame({n: p.scam_type.value_counts() for n, p in parts.items()}).fillna(0).astype(int).to_string())

for n in ("val", "test"):
    assert not parts[n].source.isin({"synthetic", "aitl_scam_dialogues", "clove_india_sms"}).any(), f"generated row in {n}"
assert sum(map(len, parts.values())) == len(full), "splits do not add up"
# Leak check, independent of build.py's word-trigram MinHash: character 5-gram Jaccard via an inverted index.
def grams(s):
    s = re.sub(r"https?://\S+|\d+", "", s.lower())
    s = re.sub(r"\W+", " ", s).strip()
    return {s[i:i + 5] for i in range(max(len(s) - 4, 1))}


def leaks(queries, pool, thr=0.8):
    pg = [grams(x) for x in pool]
    index = defaultdict(list)
    for i, g in enumerate(pg):
        for x in g:
            index[x].append(i)
    hits = []
    for q in queries:
        qg = grams(q)
        rare = sorted(qg, key=lambda x: len(index.get(x, ())))[:8]
        cand = {i for x in rare for i in index.get(x, ())}
        best = max((len(qg & pg[i]) / len(qg | pg[i]) for i in cand), default=0)
        if best >= thr:
            hits.append((round(best, 2), q[:80]))
    return hits


probe = pd.read_csv(D / "probe.csv")
parts_and_probe = {**parts, "probe": probe}
print(f"\n== probe (held-out synthetic, not in scams.csv): {len(probe)} rows", probe.groupby(["label", "scam_type"]).size().to_dict())
for a, b in (("val", "train"), ("test", "train"), ("test", "val"), ("probe", "train")):
    hits = leaks(parts_and_probe[a].text.tolist(), parts[b].text.tolist())
    print(f"near-duplicates {a} vs {b}: {len(hits)}", *hits[:3], sep="\n  ")
    assert not hits, f"near-duplicate text leaks: {a} vs {b}"
assert full.source.value_counts(normalize=True).max() <= 0.40 + 1e-9, "a source is above 40%"
print("\nOK: schema, no dupes, no generated rows in val or test, no cross-split leaks, every source <= 40%")
