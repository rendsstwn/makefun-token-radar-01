// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, and a per-protocol detail panel carrying the
// model's own inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var RADAR = window.RADAR;
  if (!RADAR) return;
  var mount = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  // ------------------------------------------------------------- formatting

  var usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function formatMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFormat.format(n);
  }

  function formatPercent(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  function formatAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model, recomputed in the page: a row is re-scored from the snapshot figures and checked
  // against the number board.json carries, so the page's arithmetic and the board's data are
  // visibly the same. The multiple is fitted on traded peers and carried on the row; the page
  // does not invent it.
  function recomputeImplied(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.multiple * growthMult * maturity));
  }

  // ------------------------------------------------------------- element builder

  // A small DOM helper: tag, attributes, then children. Attribute keys are special-cased —
  // class, text, html, on* handlers — and anything else becomes a plain attribute when set.
  function h(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    var kids = Array.prototype.slice.call(arguments, 2);
    kids.forEach(function (child) {
      if (child === null || child === undefined) return;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    });
    return node;
  }

  // ------------------------------------------------------------- the farm plan

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function firstChain(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }

  function stakeSize(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }

  function holdingDays(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function mainAction(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('risk curator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' of USDC into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('basis trad') >= 0) return 'Deposit $' + capital + ' of USDC into the ' + name + ' basis vault on ' + chain + ' and keep the position open.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('option') >= 0) return 'Deposit $' + capital + ' into an options vault on ' + name + ' and keep the position open.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return 'Spend $' + capital + ' through ' + name + ' on ' + chain + ' and keep the receipts.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }

  function secondMove(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var small = Math.max(10, Math.round(capital / 5));
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow $' + small + ' against the supply on ' + name + ', then repay it the same week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('liquidity manager') >= 0) return 'Swap $' + small + " through " + name + "'s main pool on " + chain + ' once, and leave the receipt in the wallet.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Close the hedge on ' + name + ' and open one more small position the following week.';
    if (c.indexOf('prediction') >= 0) return 'Settle one market on ' + name + ' and place a second small position in a different market.';
    if (c.indexOf('stable') >= 0) return 'Move $' + small + ' of the stable asset between ' + chain + ' and one other chain ' + name + ' supports.';
    if (c.indexOf('rwa') >= 0) return 'Claim the yield the position earned on ' + name + ' and redeposit it the same day.';
    if (c.indexOf('insurance') >= 0) return 'Open a second, smaller cover on ' + name + ' for a different risk.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + small + ' back through ' + name + ' so the wallet shows use in both directions.';
    return 'Make a second deposit of $' + small + ' into ' + name + ' on ' + chain + ' a week after the first.';
  }

  function renderStep(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }

  function buildFarmPlan(p) {
    var chain = firstChain(p);
    var capital = stakeSize(p);
    var hold = holdingDays(p.age_days);
    var small = Math.max(10, Math.round(capital / 5));
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: mainAction(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: secondMove(p, capital, chain), cost: 'about $' + small + ' of capital and $2 of gas', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Treat the position as at risk: no token is announced, points may never convert to anything, and the deposit can be lost to a contract bug, so never farm with funds you need back.', cost: 'nothing but the log', time: '5 minutes to write the farm log' }
    ].map(renderStep);
  }

  // ------------------------------------------------------------- location hash

  // The filter state lives in the URL hash, so a filtered view and an open detail panel are
  // shareable links and survive a reload.
  function readLocationHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
  }

  function syncLocationHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // ------------------------------------------------------------- filtering and sorting

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return RADAR.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).some(function (c) { return c === state.chain; })) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  // The value a row sorts on: missing growth sorts last when descending, missing age last too.
  function sortValue(row, key) {
    if (key === 'name') return row.name.toLowerCase();
    if (key === 'tvl') return row.tvl_usd;
    if (key === 'growth') return row.change_7d === null ? -Infinity : row.change_7d;
    if (key === 'age') return row.age_days === null ? Infinity : row.age_days;
    return row.implied_value_usd;
  }

  function orderedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av = sortValue(a, key);
      var bv = sortValue(b, key);
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  // ------------------------------------------------------------- shared row bits

  // "Lending on Ethereum, Arbitrum" — the category and the first two chains, as both tables show it.
  function chainLabel(r) {
    return (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain');
  }

  function growthText(r) {
    return r.change_7d === null ? 'n/a' : formatPercent(r.change_7d);
  }

  function boardGrowthClass(r) {
    if (r.change_7d === null) return '';
    return r.change_7d >= 0 ? 'pos' : 'neg';
  }

  function liveGrowthClass(r) {
    return r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg';
  }

  function nameCell(r) {
    return h('td', null, h('div', { class: 'name' },
      h('span', null, h('b', { text: r.name }), r.on_watchlist ? null : h('span', { class: 'tag', text: 'early' })),
      h('span', { class: 'sub', text: chainLabel(r) })
    ));
  }

  function impliedCell(r, max) {
    return h('td', null, h('div', { class: 'implied' },
      h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
      h('span', null,
        h('span', { class: 'num', text: formatMoney(r.implied_value_usd) }),
        h('span', { class: 'band', text: formatMoney(r.value_band_low_usd) + ' - ' + formatMoney(r.value_band_high_usd) })
      )
    ));
  }

  // ------------------------------------------------------------- page sections

  function renderHeader() {
    return h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'mark' }), h('span', { class: 'brand-name', text: 'Token Radar' })),
      h('div', { class: 'top-meta' },
        h('span', { text: 'Snapshot ' + RADAR.as_of }),
        h('span', { text: 'DefiLlama protocol index' }),
        h('span', { text: RADAR.model_version + ' model' })
      )
    );
  }

  function ledeFacts() {
    var facts = [
      ['Watchlist covered', RADAR.watchlist_size + ' / ' + RADAR.watchlist_size],
      ['Pre-token rows scored', String(RADAR.board_size)],
      ['Early rows below the floor', String(RADAR.early_size)],
      ['Live-token protocols set aside', String(RADAR.live_size)],
      ['Fitted global multiple', String(RADAR.global_multiple)],
      ['Held-out median error', String(RADAR.validation.median_log_error) + ' log pts']
    ];
    return h('div', { class: 'facts' }, facts.map(function (f) {
      return h('div', { class: 'fact' }, h('span', { text: f[0] }), h('b', { text: f[1] }));
    }));
  }

  function renderLede() {
    var top = RADAR.rows[0];
    return h('section', { class: 'lede' },
      h('div', null,
        h('h1', { text: RADAR.board_size + ' pre-token protocols, ranked by implied value' }),
        h('p', { html: 'The watchlist is the floor: every protocol with at least <b>$' + Math.round(RADAR.floor_usd / 1e6) + 'M of TVL</b> and no token on record. The early radar adds <b>' + RADAR.early_size + ' pre-token protocols</b> below that floor, every one the exclusion rule keeps. Implied value is a fitted estimate, not a price — the top row, ' + (top ? top.name : '') + ', is valued at ' + formatMoney(top ? top.implied_value_usd : 0) + ' with a plausible band of ' + formatMoney(top ? top.value_band_low_usd : 0) + ' to ' + formatMoney(top ? top.value_band_high_usd : 0) + '.' })
      ),
      ledeFacts()
    );
  }

  function searchField() {
    var search = h('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; syncLocationHash(); renderAll(); });
    return h('div', { class: 'field' }, h('label', { for: 'q', text: 'Search' }), search);
  }

  function categoryField(categories) {
    var select = h('select', { id: 'category', 'aria-label': 'Filter by category' },
      h('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return h('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; syncLocationHash(); renderAll(); });
    return h('div', { class: 'field' }, h('label', { for: 'category', text: 'Category' }), select);
  }

  function chainField(chains) {
    var chainSelect = h('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      h('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return h('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; syncLocationHash(); renderAll(); });
    return h('div', { class: 'field' }, h('label', { for: 'chain', text: 'Chain' }), chainSelect);
  }

  function tabField() {
    var pre = h('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; renderAll(); } });
    var live = h('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; renderAll(); } });
    return h('div', { class: 'field' }, h('span', { class: 'sub', text: 'Token status' }), h('div', { class: 'tabs' }, pre, live));
  }

  function renderControls() {
    var categories = Array.from(new Set(RADAR.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chainCounts = {};
    RADAR.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { chainCounts[c] = (chainCounts[c] || 0) + 1; }); });
    var chains = Object.keys(chainCounts).sort(function (a, b) { return chainCounts[b] - chainCounts[a]; }).slice(0, 14);
    return h('div', { class: 'controls' },
      searchField(),
      categoryField(categories),
      chainField(chains),
      tabField(),
      h('span', { class: 'count', text: state.tab === 'pre-token' ? filteredRows().length + ' rows shown' : RADAR.live.length + ' live-token protocols' })
    );
  }

  function sortableHeader(key, label) {
    return h('th', { scope: 'col' },
      h('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } renderAll(); } },
        label,
        state.sort === key ? h('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function emptyBoard() {
    return h('div', { class: 'panel' }, h('div', { class: 'empty' },
      h('h2', { text: 'No protocol matches that filter' }),
      h('p', { text: 'Clear the search or pick another category to see the board again.' }),
      h('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; syncLocationHash(); renderAll(); } })
    ));
  }

  function boardRowNode(r, max) {
    return h('tr', {
      'data-selected': state.selected === r.slug ? 'true' : 'false',
      tabindex: '0',
      onclick: function () { showDetail(r.slug); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(r.slug); } }
    },
      h('td', { class: 'num', text: String(r.rank) }),
      nameCell(r),
      h('td', { class: 'num', text: formatMoney(r.tvl_usd) }),
      h('td', { class: 'num ' + boardGrowthClass(r), text: growthText(r) }),
      h('td', { class: 'num', text: formatAge(r.age_days) }),
      impliedCell(r, max),
      h('td', null, h('span', { class: 'status', text: 'no token' }))
    );
  }

  function renderBoardTable() {
    var list = orderedRows(filteredRows());
    if (list.length === 0) return emptyBoard();
    var max = list[0].implied_value_usd || 1;
    var tbody = h('tbody');
    list.forEach(function (r) { tbody.appendChild(boardRowNode(r, max)); });
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          h('thead', null, h('tr', null,
            sortableHeader('implied', 'Rank'),
            sortableHeader('name', 'Protocol'),
            sortableHeader('tvl', 'TVL'),
            sortableHeader('growth', '7d'),
            sortableHeader('age', 'Age'),
            sortableHeader('implied', 'Implied value'),
            h('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveRowNode(r) {
    var ratio = r.mcap_usd && r.tvl_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + 'x' : 'n/a';
    return h('tr', null,
      h('td', { class: 'num', text: 'live' }),
      h('td', null, h('div', { class: 'name' }, h('b', { text: r.name }), h('span', { class: 'sub', text: chainLabel(r) }))),
      h('td', { class: 'num', text: formatMoney(r.tvl_usd) }),
      h('td', { class: 'num ' + liveGrowthClass(r), text: formatPercent(r.change_7d) }),
      h('td', { class: 'num', text: formatMoney(r.mcap_usd) }),
      h('td', { class: 'num', text: ratio }),
      h('td', null, h('span', { class: 'status live', text: 'already trades' }))
    );
  }

  function renderLiveTable() {
    var tbody = h('tbody');
    RADAR.live.forEach(function (r) { tbody.appendChild(liveRowNode(r)); });
    return h('div', { class: 'panel' },
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and their market-cap/TVL ratios are what the model is fitted on.' }),
          h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Status' }), h('th', { scope: 'col', text: 'Protocol' }), h('th', { scope: 'col', text: 'TVL' }), h('th', { scope: 'col', text: '7d' }), h('th', { scope: 'col', text: 'Market cap' }), h('th', { scope: 'col', text: 'Mcap / TVL' }), h('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  // ------------------------------------------------------------- the model panel

  function multiplesColumn() {
    var m = RADAR.model;
    var topMult = RADAR.multiples.slice(0, 10);
    return h('div', null,
      h('h3', { text: 'Fitted multiples, by category' }),
      h('table', { class: 'mini-table' },
        h('thead', null, h('tr', null, h('th', { text: 'Category' }), h('th', { text: 'Peers' }), h('th', { text: 'Multiple' }))),
        h('tbody', null, topMult.map(function (c) {
          return h('tr', null, h('td', { text: c.category }), h('td', { class: 'num', text: String(c.peers) }), h('td', { class: 'num', text: String(c.multiple) }));
        }))
      ),
      h('p', { class: 'sub', text: 'Median market-cap/TVL ratio per category, shrunk toward the global ' + RADAR.global_multiple + ' with weight n / (n + ' + m.shrinkage_k + '). Categories with no traded peer use the global figure.' })
    );
  }

  function validationColumn() {
    var v = RADAR.validation;
    return h('div', null,
      h('h3', { text: 'Held-out validation' }),
      h('div', { class: 'valid' },
        h('div', { class: 'row' }, h('span', { text: 'Traded peers fitted / held out' }), h('b', { text: v.peers_fit + ' / ' + v.peers_held })),
        h('div', { class: 'row' }, h('span', { text: 'Median absolute log error' }), h('b', { text: String(v.median_log_error) + ' (flat 0.25: ' + v.flat_median_log_error + ')' })),
        h('div', { class: 'row' }, h('span', { text: 'Within 2x of the market cap' }), h('b', { text: Math.round(v.within_2x * 100) + '% (flat: ' + Math.round(v.flat_within_2x * 100) + '%)' })),
        h('div', { class: 'row' }, h('span', { text: 'Within 5x of the market cap' }), h('b', { text: Math.round(v.within_5x * 100) + '% (flat: ' + Math.round(v.flat_within_5x * 100) + '%)' })),
        h('div', { class: 'row' }, h('span', { text: 'Plausible band per row' }), h('b', { text: 'x / ' + v.band_factor }))
      ),
      h('p', { class: 'sub', text: 'Fit on one deterministic half of the traded peers, scored on the other half. The model is an order-of-magnitude estimator: a typical row lands within about ' + v.band_factor + 'x of the market cap it predicts.' })
    );
  }

  function assumptionsColumn() {
    var m = RADAR.model;
    return h('div', null,
      h('h3', { text: 'What is fitted, what is assumed' }),
      h('p', { class: 'sub', text: 'The multiples are fitted on the traded peers in this snapshot. The growth weight (' + m.growth_weight + ') and the maturity shape (' + m.maturity_floor + ' to 1.0 over ' + m.maturity_days + ' days) are priors, not fitted effects: on the traded peers the log ratio correlates only 0.10 with seven-day growth and -0.03 with log age. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.' }),
      h('p', { class: 'warn', text: 'Left out on purpose: wrapped, staked and bridged products — WBTC, Binance staked ETH and USDT0 among them — because their tokens already trade. A protocol here records no token; that is not proof it has none.' })
    );
  }

  function renderModelPanel() {
    var m = RADAR.model;
    return h('section', { class: 'panel model' },
      h('h2', { text: 'How implied value is computed' }),
      h('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      h('div', { class: 'formula' },
        'implied = round( tvl_usd x multiple(category) x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )'
      ),
      h('div', { class: 'model-grid' }, multiplesColumn(), validationColumn(), assumptionsColumn())
    );
  }

  // ------------------------------------------------------------- the detail panel

  var detailPanel = h('aside', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });

  function hideDetail() {
    state.selected = null;
    detailPanel.classList.remove('open');
    syncLocationHash();
  }

  function detailHeader(row) {
    return h('div', { class: 'detail-head' },
      h('div', null,
        h('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + RADAR.board_size + (row.on_watchlist ? ' · watchlist' : ' · early radar') }),
        h('h2', { id: 'detail-title', text: row.name }),
        h('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: hideDetail })
    );
  }

  function detailModel(row) {
    var recomputed = recomputeImplied(row, RADAR.model);
    var equationRows = [
      ['TVL', formatMoney(row.tvl_usd)],
      ['Category multiple', String(row.multiple) + 'x'],
      ['Seven-day growth', formatPercent(row.change_7d)],
      ['Age with no token', formatAge(row.age_days)],
      ['Growth multiplier', String(row.growth_multiplier)],
      ['Maturity multiplier', String(row.maturity_multiplier)]
    ];
    return h('section', { class: 'detail-section' },
      h('h3', { text: 'Implied value' }),
      h('div', { class: 'equation' },
        equationRows.map(function (pair) {
          return h('div', null, h('span', { text: pair[0] }), h('b', { class: 'num', text: pair[1] }));
        }),
        h('div', { class: 'total' }, h('span', { text: 'Implied value' }), h('b', { class: 'num', text: formatMoney(row.implied_value_usd) })),
        h('div', null, h('span', { text: 'Plausible band' }), h('b', { class: 'num', text: formatMoney(row.value_band_low_usd) + ' - ' + formatMoney(row.value_band_high_usd) }))
      ),
      h('p', { class: 'sub', text: 'Model ' + RADAR.model_version + ': the same function scores every protocol. The page recomputes this row as ' + formatMoney(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    );
  }

  function detailFarm(steps) {
    return h('section', { class: 'detail-section' },
      h('h3', { text: 'Farm plan' }),
      h('ol', { class: 'steps' }, steps.map(function (s, i) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return h('li', { class: i === steps.length - 1 ? 'risk' : null }, h('b', { text: action }), h('span', { class: 'cost', text: tail }));
      }))
    );
  }

  function showDetail(slug) {
    var row = RADAR.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    syncLocationHash();
    detailPanel.textContent = '';
    var steps = buildFarmPlan(row);
    detailPanel.appendChild(detailHeader(row));
    detailPanel.appendChild(detailModel(row));
    detailPanel.appendChild(detailFarm(steps));
    detailPanel.classList.add('open');
  }

  // ------------------------------------------------------------- render

  function renderAll() {
    mount.textContent = '';
    var shell = h('div', { class: 'shell' });
    shell.appendChild(renderHeader());
    shell.appendChild(renderLede());
    shell.appendChild(renderControls());
    shell.appendChild(state.tab === 'pre-token' ? renderBoardTable() : renderLiveTable());
    if (state.tab === 'pre-token') shell.appendChild(renderModelPanel());
    shell.appendChild(h('footer', { class: 'foot' },
      h('span', { text: 'Snapshot: ' + RADAR.source + ' · as of ' + RADAR.as_of + '.' }),
      h('span', { text: 'Implied values are this entry\u2019s own claim from the snapshot\u2019s figures, never a price and never a promise that a token is issued. A protocol listed here records no token in the snapshot; that is not proof it has none.' })
    ));
    mount.appendChild(shell);
    mount.setAttribute('aria-busy', 'false');
    if (!detailPanel.isConnected) mount.appendChild(detailPanel);
    if (state.selected) showDetail(state.selected);
    else detailPanel.classList.remove('open');
  }

  readLocationHash();
  renderAll();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && detailPanel.classList.contains('open')) hideDetail();
  });
})();
