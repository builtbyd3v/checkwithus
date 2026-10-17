"""Merge raw sources into scams.csv, then split into train/val/test.

Usage: ml/.venv/bin/python -I ml/data/build.py
Reads ml/data/raw/ (gitignored) and ml/data/synthetic.csv. See SOURCES.md and DECISIONS.md.
"""
import json
import re
import zlib
from pathlib import Path

import numpy as np
import pandas as pd

D = Path(__file__).resolve().parent
RAW = D / "raw"
SEED = 42
CAP = 0.40  # max share of any one source in scams.csv
MAX_CHARS = 1000  # call scripts are cut to SMS-ish length
GENERATED = {"synthetic", "aitl_scam_dialogues", "clove_india_sms"}  # LLM or template text: train only
SIM = 0.75  # character 5-gram Jaccard at or above this = same message (campaign variant); check.py tests at 0.8
PER_CLUSTER = 3  # real rows kept per near-duplicate cluster, so one campaign cannot dominate

# First match wins. Order matters: specific scams before generic bank wording.
TYPE_RULES = [
    ("grandparent", r"\b(grandma|grandpa|nana|grandson|granddaughter|bail)\b|\bin jail\b"),
    ("gift_card", r"gift ?cards?|itunes card|google play card|steam card|scratch the back"),
    # No bare "virus": it matches COVID lures, which are impostor or bank scams.
    ("tech_support", r"computer virus|virus(es)? (detected|found|alert)|(computer|device|pc|laptop|mac) (is|has been|may be) (infected|hacked|locked)"
                     r"|malware|spyware|tech(nical)? support|microsoft (support|tech|technician|security|windows|defender)"
                     r"|windows (support|defender|security)|norton|mcafee|geek squad|anydesk|teamviewer|remote access|icloud.*(locked|hacked)"),
    # Crypto and investment before romance and impostor: pig-butchering starts as a chat, then pitches a platform.
    ("investment", r"crypto|bitcoin|\bbtc\b|usdt|ethereum|binance|coinbase|invest(ment|ing|or)?\b|trading (app|platform|signals?)"
                   r"|forex|(guaranteed|weekly|daily) (returns?|profits?)|wrong number"),
    ("romance", r"\b(my love|darling|sweetheart|my dear|honey)\b|lonely|soulmate|widow(er)?|oil rig"),
    ("impostor", r"\birs\b|social security|\bssa\b|medicare|warrant|arrest|sheriff|marshal|government|tax refund|customs|police|court|fbi\b"),
    # Toll scams fold into delivery. "toll" alone is not enough ("Reply Toll Free"): it needs a link or pay-now wording.
    ("delivery", r"usps|\bups\b|fedex|\bdhl\b|parcel|package|shipment|deliver|courier|tracking"
                 r"|\btolls?\b.*(https?://|\.(com|net|org|info|xyz|top|us)\b|pay (now|today|immediately)|unpaid|past due|late fee)"
                 r"|e-?zpass|sunpass|fastrak"),
    ("prize", r"\bwon\b|winner|prize|lottery|sweepstake|claim|reward|selected|congratulations|free (entry|gift)|cash award|\bbonus\b"),
    ("bank_alert", r"\bbank|account (has been|is|was) (locked|suspended|limited|on hold)|verify your (account|identity)|unusual (activity|sign)|debit card|credit card|paypal|zelle|venmo|password|login|log in|sign in"),
]
TYPE_RE = [(t, re.compile(p, re.I)) for t, p in TYPE_RULES]

# Promo spam we do not want at all (MLH code of conduct: no sexualized material).
ADULT = re.compile(r"\b(?:xxx|porn|sex|bitch\w*|horny|naughty|nude|gay chat|babe|flirt|dirty)\b", re.I)
# UCI "spam" mixes prize scams with plain premium-rate promos. Scam cues; the rest is a promotion.
UCI_SCAM_CUES = re.compile(r"\bwon\b|winner|prize|claim|urgent|guaranteed|selected|award|congratulations|\bcash\b|\bverify\b|account", re.I)
GAMBLING = re.compile(r"casino|\bbet\b|betting|slots?\b|jackpot|free spins", re.I)
# NCSU labels everything phishing, but some rows are plain store promos. Unsure either way, so drop them.
PROMO = re.compile(r"\bsale\b|\d+% off|shop (our|now)|coupon|promo code", re.I)
ENGLISH = re.compile(r"\b(the|your|you|is|to|has|been|please|click)\b", re.I)
# CloveAI template bug: a name or month where the amount belongs ("Bill amount: INR Khare LLC").
BROKEN_AMOUNT = re.compile(r"(?:INR|Rs\.?|₹)\s*[A-Za-z]")


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
    df = pd.read_csv(RAW / "mendeley/Dataset_5971.csv", encoding="utf-8")
    # smishing = scam; spam = promotions = legit; ham = legit
    return rows(df, "mendeley_smishing", "LABEL", "TEXT", lambda x: "scam" if x.lower() == "smishing" else "legit")


def load_ncsu():
    # Columns are shifted in this file: the message text sits under "destination number".
    df = pd.read_csv(RAW / "ncsu/phishing_messages.csv")
    t = df["destination number"].dropna().astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    t = t[t.map(lambda x: sum(c.isascii() for c in x) / max(len(x), 1) > 0.97) & t.str.contains(ENGLISH)]
    t = t[~t.str.contains(GAMBLING) & ~t.str.contains(PROMO)]
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
    df = df[~df.text.str.contains(BROKEN_AMOUNT)]
    return rows(df, "clove_india_sms", "label", "text", {1: "scam", 0: "legit"}.get)


def load_synthetic():
    return pd.read_csv(D / "synthetic.csv")


LOADERS = [load_mendeley, load_ncsu, load_uci, load_aitl, load_clove]


def norm(s):
    """Cheap exact-template key: campaigns reuse one template with new links, numbers and names."""
    s = s.str.lower().str.replace(r"https?://\S+|\S+\.(com|net|org|info|xyz|top|co)\S*|\d+", " ", regex=True)
    s = s.str.replace(r"\W+", " ", regex=True).str.strip()
    return s.str.slice(0, 60) + "|" + s.str.slice(-40)


def shingles(text):
    """Character 5-grams after dropping links and digits. Robust to typos, junk prefixes and new numbers."""
    s = re.sub(r"\W+", " ", re.sub(r"https?://\S+|\d+", "", text.lower())).strip()
    return {s[i:i + 5] for i in range(max(len(s) - 4, 1))}


def clusters(texts, bands=24, per_band=3):
    """Near-duplicate clusters: MinHash LSH finds candidates, exact Jaccard >= SIM confirms, union-find joins."""
    sh = [shingles(t) for t in texts]
    rng = np.random.default_rng(SEED)
    p = np.uint64((1 << 61) - 1)
    a = rng.integers(1, 1 << 31, bands * per_band, dtype=np.uint64)
    b = rng.integers(0, 1 << 31, bands * per_band, dtype=np.uint64)
    parent = list(range(len(texts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    buckets = {}
    for i, s in enumerate(sh):
        h = np.array([zlib.crc32(x.encode()) for x in s], dtype=np.uint64)
        sig = ((a[:, None] * h[None, :] + b[:, None]) % p).min(axis=1)
        for k in range(bands):
            buckets.setdefault((k, sig[k * per_band:(k + 1) * per_band].tobytes()), []).append(i)
    for members in buckets.values():
        # Compare each row with up to 200 earlier rows in its bucket (big template buckets stay linear).
        for n, j in enumerate(members[1:], 1):
            for i in members[max(0, n - 200):n]:
                if find(i) != find(j) and len(sh[i] & sh[j]) / len(sh[i] | sh[j]) >= SIM:
                    parent[find(j)] = find(i)
    return [find(i) for i in range(len(texts))]


def near(queries, pool):
    """For each query: does any pool text reach SIM? Exact: a match holds at least SIM*|q| of q's 5-grams,
    so it shares one of q's rarest |q| - floor(SIM*|q|) + 1."""
    ps = [shingles(t) for t in pool]
    index = {}
    for i, s in enumerate(ps):
        for x in s:
            index.setdefault(x, []).append(i)

    def hit(q):
        qs = shingles(q)
        k = len(qs) - int(SIM * len(qs)) + 1
        cand = {i for x in sorted(qs, key=lambda x: len(index.get(x, ())))[:k] for i in index.get(x, ())}
        return any(len(qs & ps[i]) / len(qs | ps[i]) >= SIM for i in cand)

    return queries.map(hit)


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
    """80/10/10 by whole near-duplicate cluster, stratified by label+scam_type.

    Val and test take only clusters with no generated row; generated text all goes to train.
    Val sets the threshold, so it must look like real traffic, same as test.
    """
    df = df.sample(frac=1, random_state=SEED).reset_index(drop=True)
    df["strat"] = df.label + "/" + df.scam_type
    c = df.groupby("cluster").agg(strat=("strat", "first"), size=("text", "size"),
                                  gen=("source", lambda s: s.isin(GENERATED).any()))
    c = c.loc[df.cluster.drop_duplicates()]  # shuffled cluster order
    where = {}
    for _, g in c.groupby("strat", sort=False):
        quota = round(g["size"].sum() * 0.1)
        filled = {"test": 0, "val": 0}
        for cid, row in g.iterrows():
            part = "train"
            if not row.gen:
                part = next((p for p in ("test", "val") if filled[p] < quota), "train")
                if part != "train":
                    filled[part] += row["size"]
            where[cid] = part
    df["part"] = df.cluster.map(where)
    # Safety net: LSH can miss a pair. A val/test cluster with a near-duplicate in train (or test in val) moves to train.
    for held, pool in (("val", "train"), ("test", "train"), ("test", "val")):
        hit = near(df[df.part == held].text, df[df.part == pool].text.tolist())
        df.loc[df.cluster.isin(df.loc[hit[hit].index, "cluster"]), "part"] = "train"
    cols = ["text", "label", "scam_type", "source"]
    return {p: df[df.part == p][cols].sample(frac=1, random_state=SEED) for p in ("train", "val", "test")}


def main():
    df = pd.concat([f() for f in LOADERS], ignore_index=True)
    df["text"] = df.text.str.replace(r"\s+", " ", regex=True).str.strip()
    df = df[(df.text.str.len() >= 10) & ~df.text.str.contains(ADULT)]
    # LOADERS order is priority: on a duplicate, the earlier source keeps the row.
    df = df[~norm(df.text).duplicated()]
    syn = load_synthetic()
    syn = syn[~norm(syn.text).isin(set(norm(df.text)))]
    df = pd.concat([df, syn], ignore_index=True)

    df["cluster"] = clusters(df.text.tolist())
    # One label per cluster: majority vote, ties go to scam (missing a scam costs more than a hold).
    share = (df.label == "scam").groupby(df.cluster).transform("mean")
    df["label"] = np.where(share >= 0.5, "scam", "legit")
    real = df.source != "synthetic"
    df = df[~real | (df[real].groupby("cluster").cumcount() < PER_CLUSTER).reindex(df.index, fill_value=True)]
    keep_type = df.source == "synthetic"
    df["scam_type"] = [st if k and l == "scam" and st != "none" else (scam_type(t) if l == "scam" else "none")
                       for t, l, st, k in zip(df.text, df.label, df.scam_type, keep_type)]
    df = cap_sources(df)

    df[["text", "label", "scam_type", "source"]].to_csv(D / "scams.csv", index=False)
    for name, part in split(df).items():
        part.to_csv(D / f"{name}.csv", index=False)


if __name__ == "__main__":
    main()
