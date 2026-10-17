"""Merge raw sources into scams.csv, then split into train/val/test.

Usage: ml/.venv/bin/python -I ml/data/build.py
Reads ml/data/raw/ (gitignored) and ml/data/synthetic.csv. See SOURCES.md and DECISIONS.md.
"""
import json
import re
from pathlib import Path

import pandas as pd

D = Path(__file__).resolve().parent
RAW = D / "raw"
SEED = 42
CAP = 0.40  # max share of any one source in scams.csv
MAX_CHARS = 1000  # call scripts are cut to SMS-ish length
GENERATED = {"synthetic", "aitl_scam_dialogues", "clove_india_sms"}  # LLM or template text: never in test

# First match wins. Order matters: specific scams before generic bank wording.
TYPE_RULES = [
    ("grandparent", r"\b(grandma|grandpa|nana|grandson|granddaughter|bail)\b|\bin jail\b"),
    ("gift_card", r"gift ?cards?|itunes card|google play card|steam card|scratch the back"),
    ("tech_support", r"virus|malware|infected|tech(nical)? support|microsoft|norton|mcafee|geek squad|anydesk|teamviewer|remote access|icloud.*(locked|hacked)"),
    ("romance", r"\b(my love|darling|sweetheart|my dear|honey)\b|lonely|soulmate|widow(er)?|oil rig"),
    ("impostor", r"\birs\b|social security|\bssa\b|medicare|warrant|arrest|sheriff|marshal|government|tax refund|customs|police|court|fbi\b"),
    ("delivery", r"usps|\bups\b|fedex|\bdhl\b|parcel|package|shipment|deliver|courier|tracking"),
    ("prize", r"\bwon\b|winner|prize|lottery|sweepstake|claim|reward|selected|congratulations|free (entry|gift)|cash award|\bbonus\b"),
    ("bank_alert", r"\bbank|account (has been|is|was) (locked|suspended|limited|on hold)|verify your (account|identity)|unusual (activity|sign)|debit card|credit card|paypal|zelle|venmo|password|login|log in|sign in"),
]
TYPE_RE = [(t, re.compile(p, re.I)) for t, p in TYPE_RULES]

# Promo spam we do not want at all (MLH code of conduct: no sexualized material).
ADULT = re.compile(r"\b(?:xxx|porn|sex|bitch\w*|horny|naughty|nude|gay chat|babe|flirt|dirty)\b", re.I)
# UCI "spam" mixes prize scams with plain premium-rate promos. Scam cues; the rest is a promotion.
UCI_SCAM_CUES = re.compile(r"\bwon\b|winner|prize|claim|urgent|guaranteed|selected|award|congratulations|\bcash\b|\bverify\b|account", re.I)


def scam_type(text):
    for t, rx in TYPE_RE:
        if rx.search(text):
            return t
    return "other"


def rows(df, source, label_col, text_col, to_label):
    out = pd.DataFrame({"text": df[text_col].astype(str), "label": df[label_col].map(to_label), "source": source})
    return out.dropna(subset=["label"])


def load_uci():
    df = pd.read_csv(RAW / "uci/SMSSpamCollection", sep="\t", header=None, names=["l", "t"], quoting=3)
    df["l"] = [("scam" if UCI_SCAM_CUES.search(t) else "legit") if l == "spam" else "legit" for l, t in zip(df.l, df.t)]
    return rows(df, "uci_sms_spam", "l", "t", lambda x: x)


def load_mendeley():
    df = pd.read_csv(RAW / "mendeley/Dataset_5971.csv", encoding="latin-1")
    # smishing = scam; spam = promotions = legit; ham = legit
    return rows(df, "mendeley_smishing", "LABEL", "TEXT", lambda x: "scam" if x.lower() == "smishing" else "legit")




GAMBLING = re.compile(r"casino|\bbet\b|betting|slots?\b|jackpot|free spins", re.I)
ENGLISH = re.compile(r"\b(the|your|you|is|to|has|been|please|click)\b", re.I)


def load_ncsu():
    # Columns are shifted in this file: the message text sits under "destination number".
    df = pd.read_csv(RAW / "ncsu/phishing_messages.csv")
    t = df["destination number"].dropna().astype(str)
    t = t[t.map(lambda x: sum(c.isascii() for c in x) / max(len(x), 1) > 0.97) & t.str.contains(ENGLISH)]
    t = t[~t.str.contains(GAMBLING)]
    # Campaigns resend one template with random tails; one row per template head.
    t = t[~norm(t).str.slice(0, 50).duplicated()]
    return pd.DataFrame({"text": t, "label": "scam", "source": "ncsu_sms_phishing"})


def load_aitl():
    # Phone-call scripts (GPT-made). Keep the caller side: that is what a scammer says.
    convs = json.loads((RAW / "aitl/ssd.json").read_text())
    text = [" ".join(t["content"] for t in c["conversation"] if t["role"] == "user")[:MAX_CHARS] for c in convs]
    label = ["scam" if c["label"] == 1 else "legit" for c in convs]
    return pd.DataFrame({"text": text, "label": label, "source": "aitl_scam_dialogues"})


def load_clove():
    # Template-made Indian SMS (names and cities slotted in). 0 = legit, 1 = scam, checked by reading samples.
    df = pd.read_parquet(RAW / "clove/train.parquet")
    return rows(df, "clove_india_sms", "label", "text", {1: "scam", 0: "legit"}.get)


def load_synthetic():
    return pd.read_csv(D / "synthetic.csv")


LOADERS = [load_mendeley, load_ncsu, load_uci, load_aitl, load_clove]


def norm(s):
    """Near-duplicate key: campaigns reuse one template with new links, numbers and names."""
    s = s.str.lower().str.replace(r"https?://\S+|\S+\.(com|net|org|info|xyz|top|co)\S*|\d+", " ", regex=True)
    s = s.str.replace(r"\W+", " ", regex=True).str.strip()
    return s.str.slice(0, 60) + "|" + s.str.slice(-40)


def cap_sources(df):
    """Downsample so no source is above CAP of the total. Iterate since shrinking one changes the total."""
    for _ in range(10):
        counts = df.source.value_counts()
        top = counts.index[0]
        rest = len(df) - counts.iloc[0]
        limit = int(CAP * rest / (1 - CAP))
        if counts.iloc[0] <= limit:
            break
        # Trim legit rows first: scam rows are the scarce class.
        mine = df[df.source == top].sample(frac=1, random_state=SEED)
        mine = pd.concat([mine[mine.label == "legit"], mine[mine.label != "legit"]])
        df = df.drop(mine.index[: counts.iloc[0] - limit])
    return df


def split(df):
    """80/10/10 stratified by label+scam_type. Synthetic rows never go to test."""
    df = df.sample(frac=1, random_state=SEED).reset_index(drop=True)
    df["strat"] = df.label + "/" + df.scam_type
    parts = {"train": [], "val": [], "test": []}
    for _, g in df.groupby("strat"):
        n = len(g)
        n_test, n_val = round(n * 0.1), round(n * 0.1)
        real = g[~g.source.isin(GENERATED)]
        test = real.iloc[:n_test]
        rest = g.drop(test.index)
        parts["test"].append(test)
        parts["val"].append(rest.iloc[:n_val])
        parts["train"].append(rest.iloc[n_val:])
    return {k: pd.concat(v).drop(columns="strat").sample(frac=1, random_state=SEED) for k, v in parts.items()}


def main():
    df = pd.concat([f() for f in LOADERS], ignore_index=True)
    df["text"] = df.text.str.replace("\u00c2", "").str.replace(r"\s+", " ", regex=True).str.strip()
    df = df[df.text.str.len() >= 10]
    df = df[~df.text.str.contains(ADULT)]
    df["key"] = norm(df.text)
    # LOADERS order is priority: on a near-duplicate, the earlier source keeps the row.
    df = df.drop_duplicates("key").drop(columns="key")
    df["scam_type"] = [scam_type(t) if l == "scam" else "none" for t, l in zip(df.text, df.label)]
    df = cap_sources(df)

    syn = load_synthetic()
    syn = syn[~norm(syn.text).duplicated() & ~norm(syn.text).isin(set(norm(df.text)))]
    df = pd.concat([df, syn], ignore_index=True)[["text", "label", "scam_type", "source"]]

    df.to_csv(D / "scams.csv", index=False)
    for name, part in split(df).items():
        part.to_csv(D / f"{name}.csv", index=False)


if __name__ == "__main__":
    main()
