# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/rendsstwn/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/rendsstwn/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar: 198 pre-token protocols ranked by implied launch value, from the sealed DefiLlama snapshot of 14 November 2026. The board covers all 40 watchlist protocols, plus 158 more pre-token protocols below the $50M watchlist floor that the same exclusion rule keeps — every one of them a protocol with no token on record that is not a wrapped, staked or bridged product of one that already trades. The top row is Steakhouse Financial at $705.6M implied, followed by Sentora Curator ($677.9M) and Gauntlet ($420.3M).

## The model (radar-2)

Implied value = TVL × category multiple × growth multiplier × maturity multiplier.

- **Category multiple**: the median market-cap/TVL ratio of traded peers in the same category, in log space, shrunk toward the global median (0.246) with weight n / (n + 8). Fitted on the 119 traded peers inside this same snapshot — never on a hardcoded name list.
- **Growth**: seven-day TVL change, clamped to −60…+120%, weight 0.5.
- **Maturity**: 0.6 rising to 1.0 over 1,095 days since first listing; unknown age counts as 365 days.
- **Validation**: fit on one deterministic half of the traded peers, scored on the other (66 held out). Median absolute log error 1.44 — a typical row lands within about 4.2× of the market cap it predicts, versus 1.50 for a flat 0.25 multiple. The model is an order-of-magnitude estimator, and every row carries its plausible band (implied ÷ 4.2 to implied × 4.2). The growth weight and the maturity shape are priors, not fitted effects: on the traded peers the log ratio correlates only 0.10 with seven-day growth and −0.03 with log age, and the dashboard says so.
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
- `out/data.js` — the same board plus the fitted multiples, validation and the 24 live-token protocols, for the dashboard
- `out/dashboard/` — the static dashboard (`index.html`, `app.css`, `app.js`)
- `out/screenshots/` — the three screenshots
- `out/dossier.json` — the build dossier

## View the dashboard

Open `out/dashboard/index.html` in a browser, or serve `out/` over HTTP and open `/dashboard/`. It renders with no network: search, category and chain filters, pre-token / live-token tabs, sortable columns, and a detail view for every protocol (deep-linked as `#p=<slug>`) that shows the model's own inputs, recomputes the row from the snapshot figures, and shows the farm plan.

## Layout

```
main.ts                  entry point: reads the snapshot, writes board, data, dashboard, screenshots, dossier
lib/model.ts             the radar-2 model, exclusion rule, validation and farm plans
dashboard/               index.html, app.css, app.js — the static, offline dashboard
screenshots/             board, one detail view, one filtered view (1440x900)
vendor/makefun-board.ts  the house's board/dossier helpers, unchanged
```

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
