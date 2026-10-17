# Data sources

- 5 public sources + our own synthetic rows. I checked every license myself on the dataset's own page or API (2026-10-16).
- Raw files live in `ml/data/raw/` (gitignored). Rebuild: `ml/.venv/bin/python -I ml/data/build.py`.
- Every source here must also go in the README "Credits" section (RULES.md rule 2).

| Source (`source` column) | URL | License (verified) | Raw rows | Rows kept | Why we picked it |
|---|---|---|---|---|---|
| `mendeley_smishing`: Mishra & Soni, SMS Phishing Dataset for ML and Pattern Recognition (2022) | https://data.mendeley.com/datasets/f45bkkt8pr/1 (file `Dataset_5971.csv`) | CC BY 4.0 (dataset licence field) | 5,971 | 3,702 | Real SMS with a separate smishing label, so promotions and scams stay apart. |
| `ncsu_sms_phishing`: NCSU WSPR lab, "On SMS Phishing Tactics and Infrastructure" (IEEE S&P 2024; paper PDF in the repo) | https://github.com/wspr-ncsu/sms-phishing (file `phishing_messages.csv`) | MIT (repo LICENSE) | 68,029 | 1,426 | Largest real smishing set (2022-23, public SMS gateways). Modern bank, delivery and toll scams. Kept English, one row per campaign. |
| `uci_sms_spam`: Almeida & Hidalgo, SMS Spam Collection (2011) | https://archive.ics.uci.edu/dataset/228/sms+spam+collection | CC BY 4.0 (UCI page) | 5,574 | 125 | Classic real ham and spam. Most rows duplicate Mendeley, which wins on duplicates. |
| `aitl_scam_dialogues`: SUPREME Lab, AI-in-the-Loop, SSD set (2025) | https://github.com/supreme-lab/ai-in-the-loop (file `data/classification/ssd_dataset/all_data.chat.json`) | MIT (repo LICENSE) | 1,600 | 1,526 | Phone-call scripts: SSN, tech support, refund, reward scams and legit delivery or appointment calls. Fills elder call-scam types. GPT-made, so train only. |
| `clove_india_sms`: CloveAI, india-spam-sms (2025) | https://huggingface.co/datasets/CloveAI/india-spam-sms | MIT (HF license field) | 20,010 | 2,076 | Hard negatives: bank alerts, bills, deliveries, appointments, plus look-alike scams. Template-made and Indian context, so train only. 3,204 rows with a broken amount slot ("INR Khare LLC") dropped. |
| `synthetic`: our templates (`ml/data/synth.py`) | this repo | ours | 455 | 455 | Elder-scam gaps (grandparent, romance, gift card, tech support, impostor) and US hard-legit texts. Fake names, 555 numbers. Train only. |

## Checked and not used

| Source | License | Why not |
|---|---|---|
| ealvaradob/phishing-dataset (HF) | Apache-2.0 | Downloaded, then dropped. The email "phishing" class is mostly 2000s spam (pharma, dating, mortgages). About 60% junk even after keyword filters. Its SMS part repeats Mendeley. |
| MeAJOR v2 (Zenodo 18471483) | CC BY 4.0 | Downloaded, then dropped. The file holds only TREC 05-07 generic email spam. |
| Munoz & Islam balanced LLM set (Mendeley vmg875v4xs) | CC BY 4.0 | LLM-generated from Mendeley; adds no new real text. |
| difraud (HF redasers/difraud) | MIT | SMS subset is UCI plus an SMS phishing set we already have. |
| bolewara/hinglish-scam-text-dataset | CC BY 4.0 | Small; English scam rows have no stated origin; benign rows are UCI. |
| BothBosu/Scammer-Conversation | Apache-2.0 | 1,000 synthetic dialogues; AI-in-the-Loop covers the same ground with labeled legit calls. |
| Shade63/scam-classification-multiclass | "Same as original dataset" (original not named) | License unclear. |
| Smishtank (arXiv 2402.18430) | Not stated; download page 404 | No license, no download. |
| Robocall transcripts (Zenodo 21066049) | CC BY-NC 4.0 | Non-commercial only. |
| SafeRoute screenshots, UniqueData SMS | CC BY-NC(-ND) 4.0 | Non-commercial. |
| alusci/sms-otp-spam-dataset | MIT | Synthetic, labels noisy (OTP texts on both sides). |
| gandharvbakshi OTP set | MIT, but gated with "commercial licensing" by DM | Terms unclear. |
| scottleechua spam-and-marketing-sms | CC BY 4.0 | All OTP and notification text is redacted, so no hard negatives. |
| Super SMS, ExAIS, SpamHunter, NUS SMS, SpamAssassin, Enron-Spam, TREC | Not stated | No clear license. ExAIS also has personal data. |
| COVA-X, Bot Wars, PsyScam, ScamBenchmark, scam-baiting NDSS 2024 | Not released, or "on request, research only" | Not downloadable under an open license. |
