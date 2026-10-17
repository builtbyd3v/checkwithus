# Scam dataset report (2026-10-16)

- **9,346 rows** in `scams.csv`: 6,382 legit, 2,964 scam. Splits: train 7,608 / val 854 / test 884. Plus `probe.csv`: 85 held-out synthetic rows (probe v2, DECISIONS 29).
- **Val and test are 100% real text** (Mendeley, NCSU, UCI). Generated sources (our synthetic, AI-in-the-Loop, CloveAI) all go to train. Val sets the threshold, so it must look like real traffic.
- **No near-duplicates across splits:** rows are clustered (character 5-gram Jaccard >= 0.75) and whole clusters go to one split; `check.py` re-tests with its own search at 0.8 and finds 0.
- **Biggest gap:** no real, openly licensed grandparent, romance or tech-support texts exist. Those types are generated only, so test has 0 of them.
- Rebuild and check: `ml/.venv/bin/python -I ml/data/build.py && ml/.venv/bin/python -I ml/data/check.py`.

## Rows per source

| source | legit | scam | total | in val/test? |
|---|---|---|---|---|
| mendeley_smishing | 3,347 | 391 | 3,738 | yes |
| clove_india_sms | 1,977 | 99 | 2,076 | no (template-made) |
| aitl_scam_dialogues | 730 | 796 | 1,526 | no (GPT-made) |
| ncsu_sms_phishing | 0 | 1,426 | 1,426 | yes |
| synthetic | 210 | 245 | 455 | no |
| uci_sms_spam | 118 | 7 | 125 | yes |
| **total** | **6,382** | **2,964** | **9,346** | |

## Rows per scam_type (scam rows)

(Table from the v1 build; v2 adds `investment` (48 / 6 / 6) and 20 toll rows to `delivery` train. Run `check.py` for current counts.)

| scam_type | total | real (val/test-eligible) | train / val / test |
|---|---|---|---|
| other | 1,086 | 1,010 | 869 / 109 / 108 |
| bank_alert | 349 | 221 | 277 / 36 / 36 |
| delivery | 339 | 305 | 273 / 31 / 35 |
| prize | 317 | 252 | 255 / 30 / 32 |
| impostor | 308 | 34 | 275 / 2 / 31 |
| gift_card | 235 | 2 | 233 / 0 / 2 |
| tech_support | 235 | 0 | 235 / 0 / 0 |
| grandparent | 25 | 0 | 25 / 0 / 0 |
| romance | 25 | 0 | 25 / 0 / 0 |
| none (legit) | 6,336 | | 5,068 / 634 / 634 |

Note: each group's val and test shares are 10% of the whole group each, taken only from real clusters (test first, then val). When real rows are scarce, most land in test: impostor sends 31 of its 34 real rows to test.

`scam_type` for real rows comes from keyword rules (`TYPE_RULES` in `build.py`), so treat it as a rough tag, not a gold label. `other` = smishing with no rule match (crypto, toll, job, account scams).

## What was dropped and why

- **ealvaradob/phishing-dataset** (whole source): email "phishing" is mostly 2000s spam; about 60% junk after filters. Its SMS part repeats Mendeley.
- **MeAJOR v2:** only TREC generic email spam in the file.
- **Promotions relabeled legit, not dropped:** Mendeley "spam" and UCI spam with no scam cue.
- **Adult promo spam:** dropped (MLH code of conduct).
- **NCSU:** non-English rows, gambling spam, and campaign repeats (68,029 to 1,565).
- **Near-duplicates:** exact-template duplicates removed first; then at most 3 real rows per near-duplicate cluster. One label per cluster (majority vote, ties to scam).
- **CloveAI broken templates:** 3,204 rows with a name or month where the amount belongs.
- **NCSU store promos** (sale, % off, coupon): dropped, since the label is unclear.
- **Non-commercial, unclear, or unreleased licenses:** see "Checked and not used" in `SOURCES.md`.

## Image sources found (not downloaded)

| Dataset | License (verified) | Size | What it has |
|---|---|---|---|
| Phishing Website Dataset, Zenodo 8041387 | CC BY 4.0 | 10,395 sites (5,151 phishing, 5,244 legit), 38.5 GB | Screenshot, HTML, text per site; 86 brands. Best clean pick for fake bank pages. |
| Phishing website dataset, Zenodo 4922598 | CC BY 4.0 | 38.2 GB | TU/e phishing pages; screenshots not confirmed. |
| PhreshPhish (HF phreshphish/phreshphish) | CC BY 4.0 | 666,315 rows | HTML and URL only, no images. |
| PixelPatrol3D (github.com/NISLabUGA/PixelPatrol3D_Code) | Code MIT; data "research license" | 7,149 attack screenshots (scareware 213, tech support 17) | Only set with pop-up and scareware classes. License unclear: ask UGA. |
| Phishpedia 30k | Repo CC0; data not stated | ~30,000 phishing sites | Screenshot, HTML, brand. Data license unclear. |
| Phish-IRIS, Phish360, Phish-Blitz, VisualPhish, UNIMAS, IEEE DataPort sets | Academic-only, not stated, or paywalled | | Skip unless a license is confirmed. |
| SafeRoute scam screenshots, UniqueData SMS screenshots | CC BY-NC(-ND) 4.0 | Small | SMS screenshots, but non-commercial. |

Gap: no openly licensed set of fake virus / tech-support pop-ups. Synthetic screenshots may be the only option.

## Guard model results (DistilBERT, `ml/train_guard.py`)

v2 (current). Threshold set on val for 97% scam recall; test scored once. Full numbers in `ml/models/guard/eval.json` and `ml/models/coreml_eval.json`.

| split | n | scam recall | precision | false holds | ECE |
|---|---|---|---|---|---|
| val (threshold tuned here) | 854 | 97.3% | 94.3% | 2.1% | 0.019 |
| test | 884 | 93.9% | 96.7% | 1.3% | 0.014 |
| probe v1 (synthetic, held-out templates) | 40 | toll 100%, investment 13% | 100% | 0% | |

- Misses the 95% test target by about 1 point. The weakest types are `delivery` (88.6%) and `prize` (91.2%).
- Investment: real crypto texts in test are caught (6 of 6), but pig-butchering openers ("sorry, wrong number") are not (2 of 15 probe rows caught). Pitch limit: the text filter will miss many of these; the payment hold and the crypto app lock are the real catch.
- Core ML: 8-bit weights, 67 MB, 1 decision of 884 differs from PyTorch.
