"""Write reference token ids for the Swift tokenizer test, plus the vocab it must load.

Usage: ml/.venv/bin/python -I ml/make_swift_fixture.py
Writes ios/GuardKit/Tests/GuardKitTests/Resources/tokenizer_cases.json and ios/GuardKit/Sources/GuardKit/Resources/vocab.txt.
"""
import json
import shutil
from pathlib import Path

import pandas as pd
from transformers import AutoTokenizer

ML = Path(__file__).resolve().parent
KIT = ML.parent / "ios/GuardKit"
MAX_LEN = json.loads((ML / "models/guard/eval.json").read_text())["max_len"]

EDGE = [
    "Café crème, résumé, naïve façade",
    "URGENT!!! You've WON $1,000... claim @ http://bit.ly/x9Z?ref=a&b=c",
    "Grandma 👵 it's me 🙏 please send $500",
    "汉字 mixed with English 和 numbers 123",
    "tabs\tand\nnew lines\r\nand  double  spaces",
    "zero​width and soft­hyphen and nbsp here",
    "a" * 150,
    "supercalifragilisticexpialidocious antidisestablishmentarianism",
    "İstanbul ŞEHİR straße ﬁne",
    "",
    "Your code is 482913. Never share it. -Chase",
    " ".join(["word"] * 300),
]


def main():
    tok = AutoTokenizer.from_pretrained(ML / "models/guard")
    texts = pd.concat([pd.read_csv(ML / f"data/{n}.csv") for n in ("train", "test")]).text
    odd = texts[texts.map(lambda t: not t.isascii())].sample(100, random_state=1)
    plain = texts[texts.map(str.isascii)].sample(200, random_state=1)
    cases = [{"text": t, "ids": tok(t, truncation=True, max_length=MAX_LEN)["input_ids"]}
             for t in EDGE + odd.tolist() + plain.tolist()]
    out = KIT / "Tests/GuardKitTests/Resources/tokenizer_cases.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"max_len": MAX_LEN, "cases": cases}, ensure_ascii=False))
    vocab = KIT / "Sources/GuardKit/Resources/vocab.txt"
    vocab.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(ML / "models/guard/vocab.txt", vocab)
    print(f"{len(cases)} cases -> {out}")


if __name__ == "__main__":
    main()
