# CLAUDE.md — CryptoAnalyst

AI assistant guide for the **CryptoAnalyst** repository. Read this before making any changes.

---

## Project Overview

CryptoAnalyst is a cryptocurrency market analysis single-page application (SPA) built with **vanilla JavaScript, HTML5, and CSS3** — no build step, no framework, no package manager. It fetches live data from the CoinGecko public API and runs a client-side technical analysis engine to produce trading signals.

**Key features:**
- Live market data table (25/50/100 coins, sortable, filterable)
- Watchlist backed by `localStorage`
- Coin detail modal with tabs: Overview, Technical Analysis, Price Chart, Info
- Technical indicators: RSI, MACD, Bollinger Bands, SMA/EMA, ATR, Stochastic
- Interactive Chart.js price/volume charts with overlay toggles
- 90-second auto-refresh for global stats and markets
- Global stats bar: total market cap, 24h volume, BTC dominance, active coins

---

## Repository Layout

```
jumaniwu/
├── index.html               # Entry point — loads all CSS and JS, defines all HTML
├── css/
│   └── style.css            # All styling — dark theme, components, responsive layout
└── js/
    ├── api.js               # CoinGecko API wrapper with in-memory cache
    ├── technicalAnalysis.js # TA engine: RSI, MACD, BB, SMA/EMA, ATR, Stochastic
    ├── charts.js            # Chart.js v4 integration — price + volume charts
    └── app.js               # Main controller — state, DOM, events, orchestration
```

There are no other directories. All changes happen in these six files.

---

## Technology Stack

| Concern       | Technology                                      |
|---------------|-------------------------------------------------|
| Language      | Vanilla JavaScript (ES2020+)                   |
| Markup        | HTML5                                           |
| Styling       | CSS3 with custom properties                    |
| Charting      | Chart.js v4.4.0 (CDN)                         |
| Date adapter  | chartjs-adapter-date-fns v3.0.0 (CDN)         |
| Fonts         | Google Fonts — Inter, JetBrains Mono (CDN)     |
| Data source   | CoinGecko API v3 (free, no key required)       |
| Persistence   | Browser `localStorage` (watchlist only)        |

All external dependencies are loaded via CDN in `index.html` lines 10–11. **Do not introduce npm, bundlers, or build tools.**

---

## Architecture & Module Pattern

Each `.js` file is an **IIFE (Immediately Invoked Function Expression)** using the **revealing module pattern**. Modules expose only their public interface:

```javascript
const MODULE = (() => {
  // private state and helpers
  const privateVar = ...;
  function privateHelper() { ... }

  // public interface
  function publicMethod() { ... }
  return { publicMethod };
})();
```

Script load order in `index.html` matters — dependencies must be listed before dependents:
1. `api.js` → exposes `API`
2. `technicalAnalysis.js` → exposes `TA`
3. `charts.js` → exposes `Charts` (depends on `Chart` global from CDN)
4. `app.js` → orchestrates `API`, `TA`, `Charts`

---

## Code Conventions

### Naming
- **`camelCase`** — variables, functions, parameters
- **`UPPER_SNAKE_CASE`** — module-level constants (e.g., `CACHE_TTL`, `BASE`)
- **`kebab-case`** — CSS class names (e.g., `.signal-badge`, `.modal-panel`)
- Avoid `$`-prefixed DOM variables; DOM queries are made fresh as needed

### Formatting
- 2-space indentation throughout all files
- Single quotes for strings in JavaScript
- JSDoc-style block comments at the top of each file describing its purpose
- Section dividers inside files use the form: `/* ---- Section Name ---- */`

### Async / Error Handling
- Use `async/await` for all async operations; avoid raw `.then()` chains
- Wrap API calls in `try/catch` and update the UI with an error state rather than logging silently
- The `API` module handles fetch errors internally and rejects the returned promise

### Security
- Always use `escapeHtml()` (defined in `app.js:824`) before inserting user-controlled or API-sourced strings into `innerHTML`. **Never skip this.**
- No user authentication or secrets — the CoinGecko free tier requires no API key

### State Management
The single application state object lives in `app.js`:

```javascript
const state = {
  coins: [],
  watchlist: new Set(JSON.parse(localStorage.getItem('watchlist') || '[]')),
  currentCoin: null,
  currentTab: 'overview',
  searchResults: [],
  isLoading: false,
  sortField: 'market_cap_rank',
  sortDir: 'asc',
  perPage: 25,
  chartTimeframe: '30',
  activeOverlays: new Set(),
};
```

Mutate `state` directly, then call the appropriate render function. There is no reactive framework — all re-renders are explicit.

### DOM Events
- Use **event delegation** where possible (one listener on a parent, check `event.target` inside)
- Search uses a **300ms debounce** — preserve this to avoid hammering the API
- The main event wiring block is in `app.js` around lines 703–818

---

## API Module (`js/api.js`)

**Base URL:** `https://api.coingecko.com/api/v3`

**Rate limit:** ~30 requests/minute on the free tier. The module implements a 60-second in-memory cache (`CACHE_TTL = 60_000`) keyed by URL to avoid redundant calls.

**Public methods:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `API.getGlobalStats()` | `/global` | Total market cap, volume, BTC dominance |
| `API.getMarkets(page, perPage)` | `/coins/markets` | Paginated coin list with prices |
| `API.getCoinDetail(id)` | `/coins/{id}` | Full metadata for one coin |
| `API.getOHLC(id, days)` | `/coins/{id}/ohlc` | OHLC candlestick data |
| `API.getMarketChart(id, days)` | `/coins/{id}/market_chart` | Price/volume time series |
| `API.search(query)` | `/search` | Coin search by name/symbol |
| `API.getCoinList()` | `/coins/list` | Full coin id/symbol/name list |
| `API.getTrending()` | `/search/trending` | Trending coins |

**Do not add new endpoints** without checking CoinGecko rate-limit implications. Cache all new endpoints with the same TTL pattern.

---

## Technical Analysis Engine (`js/technicalAnalysis.js`)

Accepts arrays of OHLCV price data and returns indicator values and composite signals.

**Indicators implemented:**

| Indicator | Parameters | Function |
|-----------|-----------|----------|
| SMA | configurable periods | `TA.sma(prices, period)` |
| EMA | configurable periods | `TA.ema(prices, period)` |
| RSI | 14-period | `TA.rsi(prices)` |
| MACD | 12/26/9 | `TA.macd(prices)` |
| Bollinger Bands | 20-period, 2σ | `TA.bollingerBands(prices)` |
| ATR | 14-period | `TA.atr(high, low, close)` |
| Stochastic | 14,3 | `TA.stochastic(high, low, close)` |

**Composite analysis:** `TA.analyze(prices, highs, lows)` returns `{ signal, score, indicators }` where:
- `signal` is `'BUY'`, `'SELL'`, or `'HOLD'`
- `score` is 0–100 (higher = more bullish)
- Signal weights: RSI ×2, MACD ×2, Bollinger ×1.5, SMA/EMA crossover ×1, Stochastic ×1

When modifying the TA engine, verify that `analyze()` still returns valid data for both short (< 26 data points) and long (200+ data points) price series — the function must degrade gracefully when there is insufficient data for an indicator.

---

## Charts Module (`js/charts.js`)

Wraps Chart.js v4 to render a dual-axis price + volume chart inside the coin modal.

**Public methods:**

| Method | Description |
|--------|-------------|
| `Charts.render(canvasId, data, overlays)` | Draw/redraw chart with given dataset and active overlays |
| `Charts.destroy()` | Tear down Chart.js instance before re-rendering or modal close |
| `Charts.updateOverlays(overlays)` | Toggle indicator datasets without full redraw |

**Overlay datasets:** SMA 20, SMA 50, EMA 12, Bollinger Bands upper/lower. Each overlay is toggled by the buttons in the chart tab.

**Timeframes:** 1D (`1`), 7D (`7`), 1M (`30`), 3M (`90`), 6M (`180`), 1Y (`365`) — values match the `days` parameter of `API.getMarketChart()`.

Always call `Charts.destroy()` before calling `Charts.render()` to prevent Chart.js canvas reuse errors.

---

## CSS Conventions (`css/style.css`)

### Design Tokens (CSS Custom Properties on `:root`)

```css
--bg-primary:    #0d0d1a   /* page background */
--bg-secondary:  #1a1a2e   /* cards, panels */
--bg-tertiary:   #16213e   /* table rows, inputs */
--accent:        #6c63ff   /* primary action color */
--accent-hover:  #5a52d5
--green:         #00d68f   /* positive / buy signals */
--red:           #ff4d6a   /* negative / sell signals */
--yellow:        #ffd166   /* neutral / hold signals */
--text-primary:  #e8e8f0
--text-secondary:#a0a0b8
--text-muted:    #606080
--border:        #2a2a4a
```

**Always use these variables** — never hardcode color values. When adding new components, check whether an existing token applies before defining a new one.

### Signal Badge Classes
`.signal-badge.buy`, `.signal-badge.sell`, `.signal-badge.hold` — use these for all BUY/SELL/HOLD labels.

### Responsive Breakpoints
- `≤ 768px` — tablet/mobile; tables collapse, modals go full-width
- `≤ 480px` — small mobile; further layout simplifications

---

## Development Workflow

### Running Locally
No build step. Open `index.html` directly in a browser, or serve it with any static server:

```bash
# Python (built-in)
python3 -m http.server 8080

# Node (if available)
npx serve .
```

### Making Changes
1. Edit the relevant file(s) directly
2. Hard-refresh the browser (`Ctrl+Shift+R` / `Cmd+Shift+R`) to clear cached assets
3. Check the browser console for JavaScript errors
4. Test on both wide and narrow viewports for responsive layout

### No Linting or Testing
There is no automated linting, formatting, or test suite. Follow existing conventions manually. For any logic change in `technicalAnalysis.js`, manually verify the output in the browser console using the coin modal's Technical Analysis tab.

---

## Git Workflow

- Development branch: `claude/add-claude-documentation-oQwsG`
- Feature branches use the pattern: `claude/<feature-slug>-<id>`
- Commit messages are descriptive and reference which files/modules were changed
- Push with: `git push -u origin <branch-name>`

---

## Common Tasks

### Add a new technical indicator
1. Implement the calculation function in `technicalAnalysis.js` (follow the SMA/EMA pattern)
2. Integrate it into `TA.analyze()` with an appropriate weight
3. Surface the result in the Technical Analysis tab in `app.js` (find the TA tab render section)
4. Add a corresponding signal badge or metric row to the modal HTML in `index.html`

### Add a new API endpoint
1. Add a function to `api.js` using the existing `cacheFetch()` helper for automatic caching
2. Export it from the module's `return {}` block
3. Call it from `app.js` where needed

### Add a new chart overlay
1. Add the toggle button to the chart tab in `index.html`
2. Compute the overlay dataset in `charts.js` using data from `TA`
3. Register the dataset with a color from the design tokens
4. Wire the button click to `Charts.updateOverlays()` in `app.js`

### Add a new coin modal tab
1. Add the tab button in `index.html` inside `.modal-tabs`
2. Add the tab content panel with a matching `data-tab` value
3. Add the render function in `app.js` and call it from the tab-switch handler

---

## What to Avoid

- **Do not introduce npm, bundlers (webpack/vite/rollup), or transpilers.** The zero-build constraint is intentional.
- **Do not add frameworks** (React, Vue, Alpine, etc.) — this is a vanilla JS project.
- **Do not use `innerHTML` with unsanitized data.** Always call `escapeHtml()` first.
- **Do not make API calls outside the `api.js` module.** All fetch logic lives there.
- **Do not hardcode colors** in CSS or JavaScript — use the CSS custom properties.
- **Do not break the script load order** in `index.html` — modules depend on each other in sequence.
- **Do not exceed CoinGecko's rate limit** — cache all new endpoints; do not poll faster than the existing 90-second refresh interval.
