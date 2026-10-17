"""Score a labeled CSV with the phone's Guard (10 rules + tiny n-gram model), in plain Python. No Mac needed.

Usage: python -I ml/guard_check.py <csv>... [--rows]
CSV columns: text, label (scam or legit), optional scam_type. Prints recall per scam_type and false holds
for the model alone, the rules alone, and both (what the Message Filter does). --rows lists every miss and hold.

This is a copy of ios/GuardKit (ScamRules.swift, NGramScorer.swift); Swift is the source of truth.
On start it checks that every regex here matches ScamRules.swift, in order, and stops if one differs.
Standard library only, so it runs on any Python 3.
"""
import csv
import json
import math
import re
import struct
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUARD = ROOT / "ios/GuardKit/Sources/GuardKit"
META = json.loads((GUARD / "Resources/guard_ngram.json").read_text())
WEIGHTS = struct.unpack(f"<{1 << META['bits']}f", (GUARD / "Resources/guard_ngram.bin").read_bytes())


# ---- model (NGramScorer.swift; features also match ml/train_ngram.py) ----
def fnv1a(s):
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return h


def score(text):
    s = re.sub(r"\s+", " ", re.sub(r"[0-9]", "0", text.lower())).strip()
    padded, grams = f" {s} ", []
    for n in META["char_ns"]:
        grams += ["c:" + padded[i:i + n] for i in range(len(padded) - n + 1)]
    words = s.split(" ") if s else []
    grams += ["w:" + w for w in words] + ["b:" + a + " " + b for a, b in zip(words, words[1:])]
    mask = (1 << META["bits"]) - 1
    ids = {fnv1a(g) & mask for g in grams}
    z = META["bias"] + (sum(WEIGHTS[i] for i in ids) / math.sqrt(len(ids)) if ids else 0)
    return 1 / (1 + math.exp(-z))


# ---- rules (ScamRules.swift). L() records each regex literal so the parity check can compare them. ----
LITERALS = []


def L(s):
    LITERALS.append(s)
    return s


HOST = re.compile(L(r"\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[/\s?#:]|$)"), re.I)
BRANDS = ["apple", "icloud", "amazon", "usps", "ups", "fedex", "dhl", "chase", "wellsfargo", "bankofamerica",
          "citi", "paypal", "venmo", "zelle", "netflix", "irs", "ssa", "medicare", "ezpass", "sunpass",
          "coinbase", "microsoft", "walmart", "costco", "att", "verizon", "tmobile", "geico"]


def lookalike_domain(text):
    for m in HOST.finditer(text):
        labels = m.group(1).lower().split(".")
        if len(labels) < 2:
            continue
        suffix = len(labels) >= 3 and len(labels[-1]) == 2 and labels[-2] in ["co", "com", "org", "net", "gov", "ac"]
        n = len(labels) - (3 if suffix else 2)
        if labels[n] in BRANDS:
            continue
        for label in labels[:n + 1]:
            parts = label.split("-")
            if any(b in parts or (len(b) >= 5 and b in label) for b in BRANDS):
                return True
    return False


card = L(r"gift ?cards?")
link = L(r"(https?://|www\.|\b[a-z0-9-]+\.(com|net|org|info|xyz|top|us|co|vip|live|io)\b)")
never = L(r"\b(never|don'?t|do not|won'?t|will not|should not)\s+(ever\s+)?(ask (you )?to\s+)?")


def rule(rid, *patterns, unless=None):
    """Every pattern must match (AND), and `unless` must not. Case-insensitive, . matches newlines."""
    regexes = [re.compile(p, re.I | re.S) for p in patterns]
    veto = re.compile(unless, re.I | re.S) if unless else None
    return rid, lambda t: all(r.search(t) for r in regexes) and not (veto and veto.search(t))


RULES = [
    rule("gift_card",
         L(r"\b(send|text|give|read|share|email)\b.{0,60}\b(codes?|pictures?|photos?)\b|\bpay\b.{0,40}") + card
         + L(r"|\b(buy|purchase|pick up|get)\b.{0,30}") + card + L(r".{0,80}\b(fee|fine|bail|codes?|text me|send me|pay)\b"),
         card),
    rule("crypto_payment",
         L(r"\b(send|deposit|transfer|pay|buy|put)\b.{0,40}\b(bitcoin|btc|usdt|tether|crypto|ethereum)\b|\b(bitcoin|crypto) (atm|kiosk|machine)\b"),
         unless=never + L(r"(send|deposit|transfer|pay|buy|put)\b")),
    rule("withdraw_fee",
         L(r"\b(pay|deposit|top ?up|send)\b.{0,60}\b(to|before you can|so you can)\s+(withdraw|unfreeze|claim|(unlock|release|access)\s+(the |your )?(funds|profits?|money|withdrawal|earnings|balance|assets))\b")
         + L(r"|\b(withdraw\w*|unlock|release)\b.{0,60}\b(must|need to|needs?|required|first)\b.{0,40}\b(fee|tax|deposit|pay)\b")
         + L(r"|\b(before|to)\s+(withdraw\w*|unlock|release)\b.{0,60}\b(fee|deposit)\b"),
         unless=never + L(r"(pay|send|deposit|ask)\b|\bpenalty\b")),
    rule("toll_link", L(r"\btolls?\b(?![- ]?free).{0,120}") + link,
         L(r"\b(unpaid|overdue|due|pay|payment|balance|outstanding|fee|fine|penalty|settle|final notice)\b")),
    rule("remote_access", L(r"\b(anydesk|teamviewer|ultraviewer|quick ?support|logmein|remote (access|desktop|control))\b"),
         unless=never + L(r"(install|download|give|share|let|allow|use)\b")),
    rule("secrecy_money",
         L(r"\b(don'?t|do not|never) (tell|call|let) (anyone|mom|dad|your (family|kids|son|daughter|bank))\b|\bkeep (this|it) (a )?(secret|confidential|between us)\b|\bgag order\b"),
         L(r"\b(send|money|cash|wire|bail|pay|lawyer|gift ?cards?)\b|\$\d")),
    rule("safe_account", L(r"\b(safe|secure|protected) account\b|\bmove (your )?(money|funds|savings)\b"),
         unless=never + L(r"(move|transfer|send|put)\b")),
    rule("courier_cash",
         L(r"\b(courier|driver|agent|someone)\b.{0,40}\b(pick ?up|collect)\b.{0,40}\b(cash|money|payment|card)\b|\b(wire|western union|moneygram)\b.{0,60}\b(bail|lawyer|fine|arrest|jail)\b")),
    rule("arrest_threat",
         L(r"\b(warrant|arrest|lawsuit|legal action|sheriff|marshal)\b.{0,80}\b(pay|fee|fine|settle)\b|\b(pay|settle)\b.{0,60}\b(avoid|or face)\b.{0,20}\b(arrest|legal action|jail)\b")),
    ("lookalike_domain", lookalike_domain),
]


def check_parity():
    swift = (GUARD / "ScamRules.swift").read_text(encoding="utf-8")
    ids = re.findall(r'Rule\("(\w+)"', swift)
    if ids != [r[0] for r in RULES]:
        sys.exit(f"Rule list differs from ScamRules.swift: {ids}. Update ml/guard_check.py.")
    swift_lits = re.findall(r'#"(.*?)"#', swift)
    for i, (a, b) in enumerate(zip(swift_lits, LITERALS)):
        if a != b:
            sys.exit(f"Regex {i} differs from ScamRules.swift:\n  swift:  {a}\n  python: {b}\nUpdate ml/guard_check.py.")
    if len(swift_lits) != len(LITERALS):
        sys.exit(f"ScamRules.swift has {len(swift_lits)} regexes, this file {len(LITERALS)}. Update ml/guard_check.py.")


def report(path, show_rows):
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    by_type = defaultdict(lambda: [0, 0, 0, 0])  # n, model, rules, both
    legit = [0, 0, 0, 0]
    lines = []
    for r in rows:
        text, label = r["text"], r["label"].strip().lower()
        p = score(text)
        hits = [rid for rid, f in RULES if f(text)]
        model, rules = p >= META["threshold"], bool(hits)
        c = by_type[r.get("scam_type") or "scam"] if label == "scam" else legit
        c[0] += 1
        c[1] += model
        c[2] += rules
        c[3] += model or rules
        wrong = (label == "scam") != (model or rules)
        if show_rows and wrong:
            lines.append(f"  {'MISSED' if label == 'scam' else 'HELD  '} p={p:.2f} rules={hits} {text[:110]}")
    pct = lambda a, n: f"{100 * a / n:5.1f}%" if n else "    -"
    print(f"\n{path}: {len(rows)} rows                model  rules   both (Message Filter)")
    for t, c in sorted(by_type.items()):
        print(f"  {t:20s} caught  n={c[0]:4d}  {pct(c[1], c[0])} {pct(c[2], c[0])} {pct(c[3], c[0])}")
    print(f"  {'legit':20s} held    n={legit[0]:4d}  {pct(legit[1], legit[0])} {pct(legit[2], legit[0])} {pct(legit[3], legit[0])}")
    print("\n".join(lines))


if __name__ == "__main__":
    check_parity()
    paths = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not paths:
        sys.exit(__doc__)
    for path in paths:
        report(path, "--rows" in sys.argv)
