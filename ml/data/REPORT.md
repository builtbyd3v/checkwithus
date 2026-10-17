# Scam dataset report (2026-10-16)

- **14,394 rows** in `scams.csv`: 10,816 legit, 3,578 scam. Splits: train 11,557 / val 1,440 / test 1,397.
- **Test is 100% real text** (Mendeley, NCSU, UCI). Generated sources (our synthetic, AI-in-the-Loop, CloveAI) stay in train and val.
- **Biggest gap:** no real, openly licensed grandparent or romance texts exist. Those types are synthetic only, so test has 0 of them. Gift card and tech support are mostly GPT call scripts.
- **No source above 40%** (largest: Mendeley at 38%). Near-duplicates removed across all sources and checked across splits.
- Rebuild and check: `ml/.venv/bin/python -I ml/data/build.py && ml/.venv/bin/python -I ml/data/check.py`.

## Rows per source

| source | legit | scam | total | in test? |
|---|---|---|---|---|
| mendeley_smishing | 5,121 | 401 | 5,522 | yes |
| clove_india_sms | 4,443 | 605 | 5,048 | no (template-made) |
| ncsu_sms_phishing | 0 | 1,565 | 1,565 | yes |
| aitl_scam_dialogues | 741 | 796 | 1,537 | no (GPT-made) |
| synthetic | 200 | 200 | 400 | no |
| uci_sms_spam | 311 | 11 | 322 | yes |
| **total** | **10,816** | **3,578** | **14,394** | |

## Rows per scam_type (scam rows)

| scam_type | total | real (test-eligible) | train / val / test |
|---|---|---|---|
| other | 1,681 | 1,112 | 1,345 / 168 / 168 |
| delivery | 357 | 325 | 285 / 36 / 36 |
| prize | 346 | 274 | 276 / 35 / 35 |
| bank_alert | 347 | 222 | 277 / 35 / 35 |
| impostor | 302 | 33 | 242 / 30 / 30 |
| gift_card | 235 | 2 | 209 / 24 / 2 |
| tech_support | 260 | 9 | 225 / 26 / 9 |
| grandparent | 25 | 0 | 23 / 2 / 0 |
| romance | 25 | 0 | 23 / 2 / 0 |
| none (legit) | 10,816 | | 8,652 / 1,082 / 1,082 |

Note: each group's test share is 10% of the whole group, taken only from real rows. When real rows are scarce, most of them land in test: impostor sends 30 of its 33 real rows to test, so train sees almost only generated impostor text (see `split()` in `build.py`).

`scam_type` for real rows comes from keyword rules (`TYPE_RULES` in `build.py`), so treat it as a rough tag, not a gold label. `other` = smishing with no rule match (crypto, toll, job, account scams).

## What was dropped and why

- **ealvaradob/phishing-dataset** (whole source): email "phishing" is mostly 2000s spam; about 60% junk after filters. Its SMS part repeats Mendeley.
- **MeAJOR v2:** only TREC generic email spam in the file.
- **Promotions relabeled legit, not dropped:** Mendeley "spam" and UCI spam with no scam cue.
- **Adult promo spam:** dropped (MLH code of conduct).
- **NCSU:** non-English rows, gambling spam, and campaign repeats (68,029 to 1,565).
- **Near-duplicates:** same text after removing digits and links (first 60 + last 40 characters). Example: 638 Mendeley smishing rows hold only 375 distinct templates.
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

## Next steps for training

1. Train DistilBERT on `train.csv`, tune the threshold on `val.csv`, report on `test.csv`.
2. Report grandparent, romance, gift card and tech support recall on a hand-written real-world set (Teammate C's 200 elder scams), since test has almost none.
