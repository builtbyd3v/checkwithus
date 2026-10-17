# Dataset decisions (2026-10-16)

Choices made while Dev was away. Each one is a default; change it and rerun `build.py`.

1. **Hackathon mode marker** goes in `CLAUDE.local.md`, not the shared `CLAUDE.md`. The shared file is the team's; the local one stays out of git.
2. **Python 3.12 venv at `ml/.venv`** (Homebrew python@3.12). Only pandas and pyarrow, pinned in `ml/requirements.txt`. No scikit-learn: the stratified split is 20 lines of pandas.
3. **Mendeley site footer** ("All rights are reserved, including those for text and data mining, AI training") is the Elsevier site-wide footer. The dataset's own licence field says CC BY 4.0, so we use it and credit the authors. Revisit if the team wants zero ambiguity.
4. **Promotions are legit.** Mendeley "spam" (premium-rate promos) becomes legit. UCI "spam" becomes scam only if it has a scam cue (won, prize, claim, urgent, cash, verify, account); the rest is a promotion and becomes legit.
5. **Adult promo spam is dropped**, not relabeled (MLH code of conduct: no sexualized material).
6. (Superseded by 16.) ealvaradob rows with no scam cue were dropped first.
7. **Long texts are cut to 1,000 characters** (call scripts), to stay close to SMS length.
8. **NCSU SMS phishing:** English-only filter (ASCII share and common English words), gambling spam dropped, one row per campaign template (first 50 normalised characters).
9. **Near-duplicate key** = lowercase text with digits and links removed, first 60 + last 40 characters. Applied across all sources and to synthetic rows, and used by the leak check.
10. **Duplicate priority** = loader order (Mendeley, NCSU, UCI, AI-in-the-Loop, CloveAI). Real sources win over generated ones.
11. **40% source cap** trims the largest source's legit rows first, since scam rows are scarce.
12. **AI-in-the-Loop SSD** call scripts are GPT-made. We keep only the caller's turns, and treat them like synthetic: never in test.
13. **scam_type for real rows** comes from keyword rules in `build.py` (first match wins). Legit rows get `none`. Rows with no match get `other`.
14. **Synthetic rows** come from templates in `synth.py` with fake names, 555 numbers and made-up domains (RULES.md rule 4). 25 per scam type, 200 hard-legit.
15. **MeAJOR v2 (CC BY 4.0) dropped:** the published file holds only TREC 05-07 generic spam, no Nazario or 419 rows, so it adds nothing over what we have.
16. **ealvaradob dropped entirely** after three filter passes. Its email "phishing" class stayed about 60% generic spam. The app screens texts, so losing email costs little.
17. **NCSU phishing set added** (MIT, real 2022-23 smishing). The message text sits in the column named `destination number` in that file.
18. **AI-in-the-Loop SSD and CloveAI** are generated text. Both count as generated (`GENERATED` in `build.py`) and never go to test.
19. **Skipped new candidates** from the recent-datasets search (difraud, bolewara, BothBosu): duplicates of UCI/Mendeley, or small with unstated origin.
20. **Image datasets: listed only**, per the task. Best clean pick: Zenodo 8041387 (CC BY 4.0).
