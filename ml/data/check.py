"""Done-check: load every CSV, print counts, assert the split rules.

Usage: ml/.venv/bin/python -I ml/data/check.py
"""
from pathlib import Path

import pandas as pd

D = Path(__file__).resolve().parent
TYPES = {"impostor", "tech_support", "gift_card", "prize", "romance", "grandparent", "bank_alert", "delivery", "other", "none"}

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

assert not parts["test"].source.isin({"synthetic", "aitl_scam_dialogues", "clove_india_sms"}).any(), "generated row in test"
assert sum(map(len, parts.values())) == len(full), "splits do not add up"
# Same near-duplicate key as build.py: digits, links and case stripped.
key = lambda s: set(s.str.lower().str.replace(r"https?://\S+|\S+\.(?:com|net|org|info|xyz|top|co)\S*|\d+", " ", regex=True)
                   .str.replace(r"\W+", " ", regex=True).str.strip().pipe(lambda x: x.str.slice(0, 60) + "|" + x.str.slice(-40)))
seen = key(parts["train"].text)
assert not (key(parts["val"].text) | key(parts["test"].text)) & seen, "near-duplicate text leaks across splits"
assert full.source.value_counts(normalize=True).max() <= 0.40 + 1e-9, "a source is above 40%"
print("\nOK: schema, no dupes, no synthetic in test, no cross-split leaks, every source <= 40%")
