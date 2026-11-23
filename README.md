# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/rendsstwn/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/rendsstwn/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: 198 pre-token protocols ranked by implied launch value, from the sealed DefiLlama snapshot of 14 November 2026. The board covers all 40 watchlist protocols, plus 158 more pre-token protocols below the $50M watchlist floor that the same exclusion rule keeps — every one of them a protocol with no token on record that is not a wrapped, staked or bridged product of one that already trades. The top row is Sentora Curator at $107.5M implied, followed by Steakhouse Financial ($107.4M) and Polymarket International ($97.6M).

## The model (radar-4)

Implied value = TVL × effective multiple, where the multiple comes from a fitted size curve: ln(market cap) = 7.7881 + 0.4721 × ln(TVL) + category effect. The formula is unchanged from radar-3: radar-4 re-tested it against 37 variants on four held-out splits — age shrinkage for young protocols, a fitted log-age term, size-band category effects, a trimmed-mean effect, per-category slopes, a fitted chains term, capped and positive-only growth, and a residual regression on age, chains and growth — and re-tested the best-looking ones on 20 seeded random 50/50 splits. None of them beat radar-3 on even half the seeds: the apparent gains were selection noise. The model is at the noise floor of these 119 peers, so radar-4 keeps the formula and improves the dashboard instead: the three launches to watch are on the first screen with the reason each sits there, and every board row shows its multiple.

- **Size slope**: market cap grows roughly with the square root of TVL, not in proportion to it. The slope (0.4721) is fitted by ordinary least squares on the 119 traded peers inside this same snapshot — never on a hardcoded name list. A $2.7B protocol gets a far lower multiple than a $200M one in the same category; the proportional model overvalued every giant on the board.
- **Category effect**: each category's median residual from that line, shrunk toward the global effect (1.0838x) with weight n / (n + 4). Categories with no traded peer use the global figure.
- **Tested and dropped**: seven-day growth (adding it at weight 0.25 moved the five-fold median error from 1.22 to 1.25), the age/maturity curve (it left the primary median error unchanged at 1.26), chain count, and an Ethereum flag (its effect flips sign across folds). The dashboard shows each row's growth and age; neither moves the value. radar-4's wider re-test added age shrinkage, size-band effects, per-category slopes and a residual regression — none of them beat radar-3 across the four held-out splits.
- **Validation, three ways, all on held-out peers**: primary split (fit even-hash half, score odd half, 66 held out) — median absolute log error 1.26, within 2x 36%, within 5x 58%; second blind split (hash mod 3, 40 held out) — 1.12 / 30% / 60%; walk-forward (fit older-listed half, score newer-listed half, 43 held out) — 0.82 / 42% / 60%. A flat 0.25 multiple scores 1.50 / 36% / 55% on the same primary peers. The model is an order-of-magnitude estimator, and every row carries its plausible band (implied ÷ 3.5 to implied × 3.5). The within-category spread of log market-cap/TVL is wide, so no model fitted on these 119 peers can do much better; the dashboard says that plainly.
- **What is left out on purpose**: wrapped, staked and bridged products — WBTC, Binance staked ETH and USDT0 among them — because their tokens already trade. A protocol listed here records no token in the snapshot; that is not proof it has none, and no implied value is a price or a promise that a token is ever issued.

Every row also carries a 7-step farm plan: concrete actions with capital, gas cost and time, derived from the protocol's own category, chains, TVL and age — plus a final risk step that says plainly that no token is announced, points may never convert to anything, and the deposit can be lost.

## Run it

Node 22.18+ (the program is TypeScript run as-is, standard library only, no network, no clock, no randomness — two runs write identical bytes).

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

In the grader the snapshot is mounted at `/input/snapshot.json` and the output at `/output`; locally, point `--input` at the kit's `input/snapshot.json`. This writes:

- `out/board.json` — the 198 ranked rows with implied values and farm plans
- `out/data.js` — the same board plus the fitted size curve, category effects, three validations and the 24 live-token protocols, for the dashboard
- `out/dashboard/` — the static dashboard (`index.html`, `app.css`, `app.js`)
- `out/screenshots/` — the three screenshots
- `out/dossier.json` — the build dossier

## View the dashboard

Open `out/dashboard/index.html` in a browser, or serve `out/` over HTTP and open `/dashboard/`. It renders with no network: the three launches to watch on the first screen with the reason each sits there, search, category and chain filters, pre-token / live-token tabs, sortable columns, and a detail view for every protocol (deep-linked as `#p=<slug>`) that shows the model's own inputs, recomputes the row from the snapshot figures, gives a farm verdict, and shows the farm plan. An integrity strip above the board recomputes every row in-page and checks watchlist coverage and rank order on every load. The model panel shows the fitted size curve as a scatter of all 119 traded peers, the category effects, and all three held-out validations.

## Layout

```
main.ts                  entry point: reads the snapshot, writes board, data, dashboard, screenshots, dossier
lib/model.ts             the radar-4 model, exclusion rule, validation and farm plans
dashboard/               index.html, app.css, app.js — the static, offline dashboard
screenshots/             board, one detail view, one filtered view (1440x900)
vendor/makefun-board.ts  the house's board/dossier helpers, unchanged
```

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
