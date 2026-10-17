# checkwith.us

Scam protection where the older adult does nothing and the family does the work.

Scam texts are filtered before they are read, scam calls ring as "Possible scam,"
and risky payments pause until a family member approves them with Face ID. All
scam detection runs on the phone — the older adult's texts and bills never leave
the device.

Built at SwampHacks XII (Oct 16–18, 2026).

## Repo layout

```
ios/    older adult app, family app, Message Filter + Call Directory extensions
web/    Next.js backend + family dashboard (Vercel)
ml/     datasets, training, eval scripts, exported models
docs/   rules, Devpost write-up, demo script, research
```

Contributors and agents: read [AGENTS.md](AGENTS.md) first, then
[docs/RULES.md](docs/RULES.md).

## Model evaluation

Test set: real texts only (Mendeley, NCSU, UCI), no near-duplicates of training rows. Threshold set on val. The 97% val target (v2 and tiny) was picked after seeing one test result ([DECISIONS 26](ml/data/DECISIONS.md)), so those test numbers are slightly optimistic. Probe: 40 held-out synthetic toll and investment texts (no real ones exist). Data: `ml/data/REPORT.md`.

| Model | Test n | Accuracy | Scam recall | False holds | ECE | Delivery + toll recall (test / probe) | Investment recall (test / probe) | iPhone latency |
|---|---|---|---|---|---|---|---|---|
| Guard v1: DistilBERT, val target 95% | 878 | 97.6% | 98.4% | 2.7% | 0.029 | 100% / n/a | n/a | not measured |
| Guard v2: + toll and investment data, val target 97% | 884 | 97.4% | 93.9% | 1.3% | 0.014 | 88.6% / 100% | 100% (6) / 13% | not measured |
| Guard v2, Core ML 8-bit (`GuardInt8.mlpackage`, 67 MB) | 884 | | 94.0% | 1.1% | | | | not measured (Mac: 1.3 ms) |
| Rules only (`ios/GuardKit/ScamRules.swift`, 9 rules) | 884 | | 2.4% | 0.0% | | | / 47% | |
| Rules + Core ML model, Swift end to end (`swift run guard-eval`) | 884 | | 94.0% | 1.1% | | | / 57% | not measured (Mac: 1.4 ms) |
| **Guard tiny: char + word n-grams, logistic regression, 1 MB (runs in the Message Filter)** | 884 | | 96.0% | 2.4% | | 100% / 100% | 100% (6) / 13% | **11 ms, 2.6 MB on iPhone 18 Pro Max** |

v1 and v2 use slightly different test sets (the data changed), so compare with care. Legit "Toll Free" texts in test held by v2: 0 of 3. Rules hold 0 of 6,382 legit texts across train, val and test. The Message Filter extension is killed above roughly 25-30 MB (measured with a probe on iOS 26), so DistilBERT (67 MB) runs only in the main app; the tiny model runs in the filter.

## AI tool disclosure

Required by SwampHacks and MLH rules, and disclosed on Devpost.

| Tool | Used for |
| --- | --- |
| Claude Code (Opus 5) | `web/` backend and dashboard: scaffolding, Nessie and Auth0 integration, family-circle logic, Tiger Data schema. Each PR notes the tools used. |
| Codex CLI | Independent second-opinion review of changed files via a `Stop` hook. Read-only; it reviews, a human and the authoring agent decide. |
| Claude Code (Opus 5.5) | `ml/` and `ios/`: dataset pipeline, training and eval scripts, Core ML export, GuardKit Swift package, Message Filter extension. Haiku subagents searched for datasets; every license was then checked by hand. |
| Codex CLI (review panel) | Read-only review of the `ml/` dataset; found near-duplicate leaks and label conflicts that were then fixed. |

All code in this repository was written during the event window. The on-device
models are fine-tuned by us; the project is not a reskin of an existing AI tool.

## Credits

Every third-party framework, library, API, model and dataset we use, with its
license. Required by Devpost rule 10 and `docs/RULES.md`.

### Services and APIs

| Service | Used for | Terms |
| --- | --- | --- |
| [Capital One Nessie](http://api.nessieisreal.com/) | Mock accounts, merchants, bills, transfers | Capital One hackathon sandbox; mock data only |
| [Auth0](https://auth0.com/) | Family member identity and payment approval | Auth0 free plan, developer terms |
| [Tiger Data / Tiger Cloud](https://www.tigerdata.com/) | Spending history, continuous aggregates, dashboard | Tiger Cloud trial; TimescaleDB extension |
| [Vercel](https://vercel.com/) | Hosting for `web/` | Vercel Hobby terms |
| [GoDaddy Registry](https://registry.godaddy/) | `checkwith.us` domain | Registered via MLH hackathon offer |

### `web/` dependencies

| Package | Version | License |
| --- | --- | --- |
| [next](https://github.com/vercel/next.js) | 16.4.2 | MIT |
| [react](https://github.com/facebook/react) | 19.3.0 | MIT |
| [react-dom](https://github.com/facebook/react) | 19.3.0 | MIT |
| [tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 4.3.3 | MIT |
| [typescript](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 |
| [eslint](https://github.com/eslint/eslint) | 9.39.5 | MIT |
| [node-postgres (`pg`)](https://github.com/brianc/node-postgres) | 8.23.1 | MIT |
| [zod](https://github.com/colinhacks/zod) | 4.6.7 | MIT |
| [jose](https://github.com/panva/jose) | 6.2.12 | MIT |
| [server-only](https://www.npmjs.com/package/server-only) | 0.0.1 | MIT |
| [vitest](https://github.com/vitest-dev/vitest) | 5.0.5 | MIT |

Type definitions (`@types/*`) come from
[DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) (MIT).

### `ml/` models and datasets

Full details, row counts and rejected sources: [`ml/data/SOURCES.md`](ml/data/SOURCES.md).

| Model or dataset | Used for | License |
| --- | --- | --- |
| [distilbert-base-uncased](https://huggingface.co/distilbert/distilbert-base-uncased) | Base model for the main-app Guard; its WordPiece vocab is bundled in GuardKit | Apache-2.0 |
| [SMS Phishing Dataset (Mishra & Soni, Mendeley)](https://data.mendeley.com/datasets/f45bkkt8pr/1) | Training and test data | CC BY 4.0 |
| [SMS phishing messages (NCSU WSPR lab)](https://github.com/wspr-ncsu/sms-phishing) | Training and test data | MIT |
| [SMS Spam Collection (UCI)](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) | Training and test data | CC BY 4.0 |
| [AI-in-the-Loop SSD (SUPREME Lab)](https://github.com/supreme-lab/ai-in-the-loop) | Training data (scam call scripts) | MIT |
| [CloveAI/india-spam-sms](https://huggingface.co/datasets/CloveAI/india-spam-sms) | Training data (hard negatives) | MIT |

| Python package | Version | License |
| --- | --- | --- |
| [pandas](https://github.com/pandas-dev/pandas) | 2.2.3 | BSD-3-Clause |
| [pyarrow](https://github.com/apache/arrow) | 18.1.0 | Apache-2.0 |
| [torch](https://github.com/pytorch/pytorch) | 2.4.1 | BSD-3-Clause |
| [transformers](https://github.com/huggingface/transformers) | 4.46.3 | Apache-2.0 |
| [coremltools](https://github.com/apple/coremltools) | 8.1 | BSD-3-Clause |

### `ios/` dependencies

No third-party Swift packages. `ios/GuardKit` is our own package (tokenizer, rules, scorers); Apple frameworks only (Core ML, IdentityLookup).

## Demo data

Demo data uses fake people only. No real person's name, phone number, bank
details or messages appear in this repository or in the demo.

Exception: `ml/data/` contains published, openly licensed research SMS datasets
(listed in Credits) used to train and test the scam model. They are never shown
in the demo. Our own synthetic rows use fake names, 555 numbers and made-up domains.
