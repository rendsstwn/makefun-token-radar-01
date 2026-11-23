// The token radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other pre-token protocol the house's own exclusion rule keeps: the early rows the radar exists to
// find. A protocol is rankable when it records no token (no market cap, no CoinGecko id, no symbol)
// AND it is not a wrapped, staked or bridged product of a token that already trades: the same
// exclusions the watchlist rule uses (an excluded category, a wrapped/staked/staking name, an
// exchange-prefixed name, a versioned name). The starter ranked WBTC, Binance staked ETH and USDT0
// at the top of its early rows by TVL alone; this model leaves them out, because their tokens
// already trade and they are not launches waiting to happen. Live-token protocols are kept apart
// and shown as the market's own values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, and it is fitted, not asserted:
//
//   multiple   = a category multiple fitted on the traded peers inside this same snapshot:
//                the median market-cap/TVL ratio per category, shrunk toward the global median
//                with weight n / (n + 8), so a category with one peer barely moves the global
//                figure and a category with many peers speaks for itself. In log space, because
//                the ratios are heavy-tailed and a mean would be dragged by outliers.
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x 0.5
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age unknown: 365 days)
//   implied    = max(1, round(tvl_usd x multiple x growthMult x maturity))
//
// What is fitted and what is assumed, stated plainly: the multiple is fitted on 119 traded peers
// in this snapshot. The growth weight (0.5) and the maturity shape (0.6 to 1.0 over three years)
// are priors, not fitted effects: on the traded peers the log market-cap/TVL ratio correlates
// only 0.10 with seven-day growth and -0.03 with log age, so neither term is claimed as a measured
// effect. The dashboard shows the held-out validation, so a reader can see how rough the estimate
// is: the model is an order-of-magnitude estimator, and every row carries the plausible band the
// validation's median error implies.
//
// No protocol name is ever special-cased: the same functions score every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  /** Shrinkage strength for the category multiples: weight n / (n + shrinkage_k). */
  shrinkage_k: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  shrinkage_k: 8,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** Plausible band from the held-out validation's median log error: [implied / band, implied x band]. */
  value_band_low_usd: number;
  value_band_high_usd: number;
  on_watchlist: boolean;
  model: {
    multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  value_band_low_usd: number;
  value_band_high_usd: number;
  on_watchlist: boolean;
  multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One fitted category multiple, for the dashboard's model table. */
export interface CategoryMultiple {
  category: string;
  multiple: number;
  peers: number;
}

/** The held-out validation of the model, fitted on one deterministic half of the traded peers and
 *  scored on the other half. */
export interface Validation {
  peers_fit: number;
  peers_held: number;
  /** Median absolute log error of the category model on the held-out peers. */
  median_log_error: number;
  /** Share of held-out peers whose market cap the model lands within 2x of. */
  within_2x: number;
  /** Share of held-out peers whose market cap the model lands within 5x of. */
  within_5x: number;
  /** The same three numbers for a flat 0.25 multiple, on the same held-out peers. */
  flat_median_log_error: number;
  flat_within_2x: number;
  flat_within_5x: number;
  /** exp(median_log_error): the band factor applied to every row's implied value. */
  band_factor: number;
}

/** Everything the dashboard needs: the board, the live set, the fitted model and its validation. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  multiples: CategoryMultiple[];
  validation: Validation;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** FNV-1a 32-bit hash: the deterministic split of the traded peers for validation. */
function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** The traded peers the multiples are fitted on: a token that trades, a positive market cap and TVL,
 *  and not an exchange, whose own token prices nothing like a protocol's. */
function tradedPeers(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX',
  );
}

/** The fitted comps: the global log-median market-cap/TVL ratio and one per category. */
export interface Comps {
  globalLogMedian: number;
  byCategory: Map<string, { logMedian: number; peers: number }>;
  peers: number;
}

function fitComps(peers: SnapshotProtocol[], shrinkageK: number): Comps {
  const globalLogMedian = median(peers.map((p) => Math.log(p.mcap_usd! / p.tvl_usd)));
  const grouped = new Map<string, number[]>();
  for (const p of peers) {
    const key = p.category ?? 'null';
    const list = grouped.get(key) ?? [];
    list.push(Math.log(p.mcap_usd! / p.tvl_usd));
    grouped.set(key, list);
  }
  const byCategory = new Map<string, { logMedian: number; peers: number }>();
  for (const [key, list] of grouped) byCategory.set(key, { logMedian: median(list), peers: list.length });
  void shrinkageK;
  return { globalLogMedian, byCategory, peers: peers.length };
}

/** The category multiple for one protocol: its category's log-median shrunk toward the global one. */
export function categoryMultiple(comps: Comps, category: string | null, shrinkageK: number): number {
  const entry = comps.byCategory.get(category ?? 'null');
  if (entry === undefined) return Math.exp(comps.globalLogMedian);
  const w = entry.peers / (entry.peers + shrinkageK);
  return Math.exp(w * entry.logMedian + (1 - w) * comps.globalLogMedian);
}

/** The held-out validation: fit the comps on the even-hash half of the traded peers, score the odd half. */
export function validateComps(snapshot: Snapshot, model: ModelConstants): Validation {
  const peers = tradedPeers(snapshot);
  const fit = peers.filter((p) => hash32(p.slug) % 2 === 0);
  const held = peers.filter((p) => hash32(p.slug) % 2 !== 0);
  const comps = fitComps(fit, model.shrinkage_k);
  const score = (predict: (p: SnapshotProtocol) => number): { med: number; w2: number; w5: number } => {
    const errors = held.map((p) => Math.abs(Math.log(predict(p) / p.mcap_usd!))).sort((a, b) => a - b);
    const med = errors[Math.floor(errors.length / 2)]!;
    const w2 = errors.filter((e) => e <= Math.log(2)).length / errors.length;
    const w5 = errors.filter((e) => e <= Math.log(5)).length / errors.length;
    return { med, w2, w5 };
  };
  const cat = score((p) => p.tvl_usd * categoryMultiple(comps, p.category, model.shrinkage_k));
  const flat = score((p) => p.tvl_usd * 0.25);
  return {
    peers_fit: fit.length,
    peers_held: held.length,
    median_log_error: round4(cat.med),
    within_2x: round4(cat.w2),
    within_5x: round4(cat.w5),
    flat_median_log_error: round4(flat.med),
    flat_within_2x: round4(flat.w2),
    flat_within_5x: round4(flat.w5),
    band_factor: round4(Math.exp(cat.med)),
  };
}

/** The three multipliers and the implied value one protocol gets under `model` and `comps`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  comps: Comps,
): { implied: number; multiple: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  // Round the multiple first: the board stores the rounded figure, and the dashboard recomputes
  // from it, so the two must agree to the dollar.
  const multiple = round4(categoryMultiple(comps, protocol.category, model.shrinkage_k));
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult));
  return { implied, multiple, growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist rule keeps out: a wrapped, staked or bridged product, or an exchange. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Exchange names a protocol may not begin with, per the watchlist rule. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whole words that mark a wrapped or staked product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Why a pre-token protocol is not a launch waiting to happen, or null when it is rankable. */
export function exclusionReason(p: SnapshotProtocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return `category ${p.category}`;
  if (WRAPPED_WORD.test(p.name)) return 'wrapped or staked product';
  if (EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))) return 'exchange product';
  if (VERSIONED.test(p.name)) return 'versioned pool';
  return null;
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token and not a wrapped, staked or bridged
 *  product of a token that already trades, by the watchlist rule applied to every row. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && exclusionReason(p) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
  comps: Comps | null = null,
  bandFactor: number | null = null,
): BoardRow[] {
  const fitted = comps ?? fitComps(tradedPeers(snapshot), model.shrinkage_k);
  const band = bandFactor ?? Math.exp(validateComps(snapshot, model).median_log_error);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, by the same exclusion rule as the
  // watchlist. No TVL cap, no hand-picked list: the radar exists to find them all.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, fitted);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    value_band_low_usd: Math.max(1, Math.round(s.implied / band)),
    value_band_high_usd: Math.round(s.implied * band),
    on_watchlist: snapshot.watchlist.includes(s.p.slug),
    model: {
      multiple: round4(s.multiple),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('basis trad')) return `Deposit $${capital} of USDC into the ${name} basis vault on ${chain} and keep the position open.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('option')) return `Deposit $${capital} into an options vault on ${name} and keep the position open.`;
  if (c.includes('payment') || c.includes('card')) return `Spend $${capital} through ${name} on ${chain} and keep the receipts.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second qualifying action: a different move on the same protocol, so the activity
 *  reads as a user, not a single deposit. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${small} against the supply on ${name}, then repay it the same week.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager')) return `Swap $${small} through ${name}'s main pool on ${chain} once, and leave the receipt in the wallet.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge on ${name} and open one more small position the following week.`;
  if (c.includes('prediction')) return `Settle one market on ${name} and place a second small position in a different market.`;
  if (c.includes('stable')) return `Move $${small} of the stable asset between ${chain} and one other chain ${name} supports.`;
  if (c.includes('rwa')) return `Claim the yield the position earned on ${name} and redeposit it the same day.`;
  if (c.includes('insurance')) return `Open a second, smaller cover on ${name} for a different risk.`;
  if (c.includes('bridge')) return `Bridge $${small} back through ${name} so the wallet shows use in both directions.`;
  return `Make a second deposit of $${small} into ${name} on ${chain} a week after the first.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. The last step states the risk plainly: no token is announced, points may never convert,
 * and the deposit is at risk.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const small = Math.max(10, Math.round(capital / 5));
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain),
      cost: `about $${small} of capital and $2 of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Treat the position as at risk: no token is announced, points may never convert to anything, and the deposit can be lost to a contract bug, so never farm with funds you need back.`,
      cost: 'nothing but the log',
      time: '5 minutes to write the farm log',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    value_band_low_usd: row.value_band_low_usd,
    value_band_high_usd: row.value_band_high_usd,
    on_watchlist: row.on_watchlist,
    multiple: row.model.multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const comps = fitComps(tradedPeers(snapshot), model.shrinkage_k);
  const validation = validateComps(snapshot, model);
  const board = buildBoard(snapshot, model, comps, validation.band_factor);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !r.on_watchlist).length;
  const multiples: CategoryMultiple[] = [...comps.byCategory.entries()]
    .map(([category, entry]) => ({
      category,
      multiple: round4(categoryMultiple(comps, category, model.shrinkage_k)),
      peers: entry.peers,
    }))
    .sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: round4(Math.exp(comps.globalLogMedian)),
    multiples,
    validation,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
