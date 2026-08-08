/* ============================================================
   totoAnalysis.js — statistical analysis of TOTO draw history
   ------------------------------------------------------------
   Everything here is descriptive statistics over past draws. None of
   it is predictive: a fair lottery draw is independent of every draw
   before it, so a number being "hot" or "overdue" carries no
   information about the next draw. The backtest at the bottom of this
   file is included precisely so that claim can be checked rather than
   taken on faith.
   ============================================================ */

const POOL = 49;
const PICK = 6;

/* ---------- small helpers ---------- */

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(sum(arr.map((v) => (v - m) ** 2)) / (arr.length - 1));
}

/** Rescale to 0..1. Returns 0.5 for everything when the range is flat. */
function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

const decadeOf = (n) => Math.min(Math.floor((n - 1) / 10), 4); // 1-10,11-20,...,41-49

/* ---------- per-number statistics ---------- */

/**
 * Frequency, gap and recency stats for every number in 1..49.
 * `draws` must be newest-first. `halfLife` is measured in draws: a hit
 * that many draws ago counts half as much as a hit in the latest draw.
 */
function numberStats(draws, halfLife = 20) {
  const total = draws.length;
  const p = PICK / POOL;
  const expected = total * p;
  // Binomial sd: each draw is one Bernoulli trial per number.
  const sd = Math.sqrt(total * p * (1 - p)) || 1;

  const stats = [];
  for (let n = 1; n <= POOL; n++) {
    const hits = [];        // indices into `draws` (0 = most recent)
    let additionalHits = 0;

    draws.forEach((d, i) => {
      if (d.n.includes(n)) hits.push(i);
      if (d.a === n) additionalHits++;
    });

    const count = hits.length;

    // Gaps between consecutive appearances. `hits` is ascending in age
    // (index 0 is the most recent draw), so the older index is the larger
    // one and must be the minuend for the interval to come out positive.
    const intervals = [];
    for (let k = 1; k < hits.length; k++) intervals.push(hits[k] - hits[k - 1]);

    // Draws since last appearance. Never-drawn numbers get the full window.
    const gap = count ? hits[0] : total;
    // Fall back to the theoretical average gap (49/6) when we have too
    // few appearances to measure one.
    const avgGap = intervals.length ? mean(intervals) : POOL / PICK;
    const maxGap = intervals.length ? Math.max(...intervals) : gap;

    const recencyWeight = sum(hits.map((i) => Math.pow(0.5, i / halfLife)));

    stats.push({
      n,
      count,
      additionalHits,
      freq: total ? count / total : 0,
      expected,
      zScore: (count - expected) / sd,
      gap,
      avgGap,
      maxGap,
      overdueRatio: avgGap ? gap / avgGap : 0,
      recencyWeight,
      lastSeen: count ? draws[hits[0]] : null,
    });
  }
  return stats;
}

/* ---------- pair co-occurrence ---------- */

/** How often each unordered pair {a,b} landed in the same draw. */
function pairMatrix(draws) {
  const m = Array.from({ length: POOL + 1 }, () => new Array(POOL + 1).fill(0));
  for (const d of draws) {
    for (let i = 0; i < d.n.length; i++) {
      for (let j = i + 1; j < d.n.length; j++) {
        m[d.n[i]][d.n[j]]++;
        m[d.n[j]][d.n[i]]++;
      }
    }
  }
  return m;
}

function topPairs(matrix, limit = 12) {
  const out = [];
  for (let a = 1; a <= POOL; a++) {
    for (let b = a + 1; b <= POOL; b++) {
      if (matrix[a][b] > 0) out.push({ a, b, count: matrix[a][b] });
    }
  }
  return out.sort((x, y) => y.count - x.count).slice(0, limit);
}

/* ---------- draw-shape patterns ---------- */

/** Distribution of the structural properties of past winning sets. */
function patternStats(draws) {
  const sums = draws.map((d) => sum(d.n));
  const oddCounts = draws.map((d) => d.n.filter((v) => v % 2 === 1).length);
  const highCounts = draws.map((d) => d.n.filter((v) => v > POOL / 2).length);

  const oddHist = new Array(PICK + 1).fill(0);
  oddCounts.forEach((c) => oddHist[c]++);

  const highHist = new Array(PICK + 1).fill(0);
  highCounts.forEach((c) => highHist[c]++);

  const decadeHist = new Array(5).fill(0);
  draws.forEach((d) => d.n.forEach((v) => decadeHist[decadeOf(v)]++));

  const lastDigitHist = new Array(10).fill(0);
  draws.forEach((d) => d.n.forEach((v) => lastDigitHist[v % 10]++));

  // A "consecutive pair" is any two adjacent values in the sorted set.
  let consecutiveDraws = 0;
  draws.forEach((d) => {
    const s = d.n.slice().sort((a, b) => a - b);
    if (s.some((v, i) => i > 0 && v === s[i - 1] + 1)) consecutiveDraws++;
  });

  // How many numbers each draw shares with the draw immediately before it.
  const repeats = [];
  for (let i = 0; i < draws.length - 1; i++) {
    const prev = new Set(draws[i + 1].n);
    repeats.push(draws[i].n.filter((v) => prev.has(v)).length);
  }

  return {
    sum: {
      mean: mean(sums),
      sd: stdev(sums),
      min: sums.length ? Math.min(...sums) : 0,
      max: sums.length ? Math.max(...sums) : 0,
      values: sums,
    },
    oddHist,
    highHist,
    decadeHist,
    lastDigitHist,
    consecutiveRate: draws.length ? consecutiveDraws / draws.length : 0,
    repeatMean: mean(repeats),
  };
}

/* ---------- composite score ---------- */

const DEFAULT_WEIGHTS = {
  frequency: 0.30,   // favours numbers drawn more often than chance
  overdue:   0.30,   // favours numbers absent longer than their own average
  recency:   0.25,   // favours numbers active lately (half-life decay)
  pair:      0.15,   // favours numbers that co-occur with other strong numbers
};

/**
 * Blend the per-number signals into one 0..1 score per number.
 * Each component is min-max normalized first so the weights mean what
 * they look like they mean.
 */
function scoreNumbers(stats, matrix, weights = DEFAULT_WEIGHTS) {
  const zNorm = normalize(stats.map((s) => s.zScore));
  const oNorm = normalize(stats.map((s) => s.overdueRatio));
  const rNorm = normalize(stats.map((s) => s.recencyWeight));

  // Pair affinity: total co-occurrence count, i.e. how "connected" a
  // number is to the rest of the pool in this window.
  const affinity = stats.map((s) => sum(matrix[s.n].slice(1)));
  const pNorm = normalize(affinity);

  const wTotal =
    weights.frequency + weights.overdue + weights.recency + weights.pair || 1;

  return stats.map((s, i) => ({
    ...s,
    components: {
      frequency: zNorm[i],
      overdue: oNorm[i],
      recency: rNorm[i],
      pair: pNorm[i],
    },
    score:
      (weights.frequency * zNorm[i] +
        weights.overdue * oNorm[i] +
        weights.recency * rNorm[i] +
        weights.pair * pNorm[i]) /
      wTotal,
  }));
}

/* ---------- top-level ---------- */

function analyze(draws, opts = {}) {
  const halfLife = opts.halfLife ?? 20;
  const weights = opts.weights ?? DEFAULT_WEIGHTS;

  const stats = numberStats(draws, halfLife);
  const matrix = pairMatrix(draws);
  const scored = scoreNumbers(stats, matrix, weights);
  const patterns = patternStats(draws);

  const byCount = scored.slice().sort((a, b) => b.count - a.count || a.n - b.n);
  const byOverdue = scored
    .slice()
    .sort((a, b) => b.overdueRatio - a.overdueRatio || a.n - b.n);

  // Imported rows may carry no date, so derive the window from the ones
  // that do rather than reading the first and last rows blindly.
  const dated = draws.filter((d) => d.date);

  return {
    drawCount: draws.length,
    dateRange: dated.length
      ? { from: dated[dated.length - 1].date, to: dated[0].date }
      : null,
    numbers: scored,
    matrix,
    topPairs: topPairs(matrix),
    patterns,
    hot: byCount.slice(0, 10),
    cold: byCount.slice(-10).reverse(),
    overdue: byOverdue.slice(0, 10),
    expectedPerNumber: draws.length * (PICK / POOL),
  };
}

/* ---------- chi-square test for a biased pool ---------- */

/**
 * Tests the null hypothesis "every number is equally likely". A large
 * statistic relative to the degrees of freedom is the only thing that
 * would justify treating any number as genuinely favoured.
 */
function chiSquare(stats, drawCount) {
  const expected = (drawCount * PICK) / POOL;
  if (expected <= 0) return { stat: 0, df: POOL - 1, expected, interpretation: 'No data.' };

  const stat = sum(stats.map((s) => (s.count - expected) ** 2 / expected));
  const df = POOL - 1;
  // 95% critical value for df=48. Hard-coded to avoid pulling in a
  // full chi-square CDF for a single comparison.
  const critical95 = 65.17;

  return {
    stat,
    df,
    expected,
    critical95,
    biased: stat > critical95,
    interpretation:
      stat > critical95
        ? `Chi-square ${stat.toFixed(1)} exceeds the 95% critical value ${critical95} — the observed spread is wider than fair-draw noise would usually produce. With a small sample this is more likely a sampling artefact than a real bias.`
        : `Chi-square ${stat.toFixed(1)} is below the 95% critical value ${critical95} — the number distribution is statistically indistinguishable from a fair, uniform draw.`,
  };
}

/* ---------- walk-forward backtest ---------- */

/**
 * Honest evaluation. For each draw in the test window, the model is
 * rebuilt using ONLY the draws that preceded it, sets are generated,
 * and those sets are scored against what actually came out. A random
 * control runs alongside on the same draws.
 *
 * `generateFn(trainDraws, count)` returns an array of number-arrays.
 */
function backtest(draws, generateFn, opts = {}) {
  const minTrain = opts.minTrain ?? 15;
  const setsPerDraw = opts.setsPerDraw ?? 10;

  if (draws.length <= minTrain + 1) {
    return { ran: false, reason: `Need more than ${minTrain + 1} draws to backtest; have ${draws.length}.` };
  }

  // draws is newest-first; walk from oldest testable draw forward.
  const chronological = draws.slice().reverse();
  const results = { model: [], random: [] };
  // Per-draw means, kept separately because sets generated for the same
  // draw are not independent of each other (see the paired test below).
  const perDraw = [];

  for (let i = minTrain; i < chronological.length; i++) {
    const actual = new Set(chronological[i].n);
    // Training set must be newest-first to match analyze()'s contract.
    const train = chronological.slice(0, i).reverse();

    const modelMatches = generateFn(train, setsPerDraw).map(
      (s) => s.filter((v) => actual.has(v)).length
    );
    const randomMatches = [];
    for (let k = 0; k < setsPerDraw; k++) {
      randomMatches.push(randomSet().filter((v) => actual.has(v)).length);
    }

    results.model.push(...modelMatches);
    results.random.push(...randomMatches);
    perDraw.push({ model: mean(modelMatches), random: mean(randomMatches) });
  }

  const summarize = (matches) => {
    const hist = new Array(PICK + 1).fill(0);
    matches.forEach((m) => hist[m]++);
    return {
      sets: matches.length,
      avgMatches: mean(matches),
      sd: stdev(matches),
      hist,
      threePlus: matches.filter((m) => m >= 3).length,
      fourPlus: matches.filter((m) => m >= 4).length,
    };
  };

  const model = summarize(results.model);
  const random = summarize(results.random);
  const theoretical = (PICK * PICK) / POOL; // 0.7347 expected matches

  // Paired test on per-draw means. Pooling all sets and treating them as
  // independent would badly understate the standard error: every set for
  // a given draw is scored against the same six numbers, and sets from
  // one model share the same weights, so they move together. The draw is
  // the independent unit here, not the set — hence n = draws tested, and
  // pairing model against random on the same draw removes the
  // draw-to-draw difficulty that both methods face equally.
  const diffs = perDraw.map((d) => d.model - d.random);
  const diff = mean(diffs);
  const sdDiff = stdev(diffs);
  const se = diffs.length ? sdDiff / Math.sqrt(diffs.length) : 0;
  const t = se ? diff / se : 0;
  const df = Math.max(diffs.length - 1, 1);
  const crit = tCritical95(df);
  const significant = Math.abs(t) > crit;

  return {
    ran: true,
    drawsTested: chronological.length - minTrain,
    model,
    random,
    theoretical,
    diff,
    t,
    df,
    crit,
    significant,
    verdict: significant
      ? `Paired across ${diffs.length} draws, the model differs from random by ${diff.toFixed(3)} matches per set (t = ${t.toFixed(2)}, df = ${df}, critical ±${crit}). That clears the threshold, but on a window this short one unusual draw can carry the result — it is not evidence of a real edge, and no edge is possible in a fair draw.`
      : `Paired across ${diffs.length} draws, the model differs from random by ${diff.toFixed(3)} matches per set (t = ${t.toFixed(2)}, df = ${df}, critical ±${crit}) — indistinguishable from chance. The weighted model performs exactly like picking at random, which is what probability theory predicts.`,
  };
}

/** Two-sided 95% critical values for Student's t at small df. */
function tCritical95(df) {
  const table = {
    1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36,
    8: 2.31, 9: 2.26, 10: 2.23, 11: 2.20, 12: 2.18, 13: 2.16, 14: 2.14,
    15: 2.13, 16: 2.12, 17: 2.11, 18: 2.10, 19: 2.09, 20: 2.09,
    25: 2.06, 30: 2.04, 40: 2.02, 60: 2.00, 120: 1.98,
  };
  if (table[df]) return table[df];
  const keys = Object.keys(table).map(Number).filter((k) => k >= df);
  return keys.length ? table[Math.min(...keys)] : 1.96;
}

function randomSet() {
  const pool = Array.from({ length: POOL }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, PICK).sort((a, b) => a - b);
}

const TotoAnalysis = {
  analyze,
  numberStats,
  pairMatrix,
  topPairs,
  patternStats,
  scoreNumbers,
  chiSquare,
  backtest,
  tCritical95,
  randomSet,
  normalize,
  mean,
  stdev,
  sum,
  decadeOf,
  DEFAULT_WEIGHTS,
  POOL,
  PICK,
};

if (typeof module !== 'undefined' && module.exports) module.exports = TotoAnalysis;
