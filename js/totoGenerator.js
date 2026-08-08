/* ============================================================
   totoGenerator.js — number-set generation
   ------------------------------------------------------------
   Turns the analysis into playable 6-number sets. Strategies differ
   only in how they convert per-number scores into sampling weights;
   the constraint filter is shared.
   ============================================================ */

const TotoGenerator = (() => {
  const POOL = TotoAnalysis.POOL;
  const PICK = TotoAnalysis.PICK;

  const STRATEGIES = {
    balanced: {
      label: 'Balanced',
      blurb: 'Weights by the composite score — frequency, overdue, recency and pairing combined.',
      weight: (s) => s.score,
    },
    hot: {
      label: 'Hot numbers',
      blurb: 'Favours numbers drawn most often in the window.',
      weight: (s) => s.components.frequency,
    },
    cold: {
      label: 'Cold / overdue',
      blurb: 'Favours numbers absent longest relative to their own average gap.',
      weight: (s) => s.components.overdue,
    },
    pattern: {
      label: 'Pattern match',
      blurb: 'Flat weights, but only accepts sets whose shape matches historical draws.',
      weight: () => 1,
    },
    random: {
      label: 'Pure random (control)',
      blurb: 'Ignores all history. Included so you can compare against the others.',
      weight: () => 1,
    },
  };

  const DEFAULT_CONSTRAINTS = {
    enforceSum: true,       // sum within ±1.5 sd of the historical mean
    sumSigma: 1.5,
    oddEven: true,          // between 2 and 4 odd numbers
    highLow: true,          // between 2 and 4 numbers above 24
    maxConsecutive: 2,      // longest run of consecutive values
    minDecades: 3,          // spread across at least this many decade bands
    excludePastDraws: true, // never reproduce a set that already won
  };

  /**
   * Weighted sampling without replacement.
   * `bias` sharpens (>1) or flattens (<1) the weight differences.
   */
  function weightedPick(weights, count, bias = 1) {
    // Floor keeps every number reachable, so a zero-scored number is
    // unlikely rather than impossible.
    const pool = weights.map((w, i) => ({
      n: i + 1,
      w: Math.pow(Math.max(w, 0.001), bias),
    }));
    const chosen = [];

    for (let k = 0; k < count && pool.length; k++) {
      const total = pool.reduce((a, b) => a + b.w, 0);
      let r = Math.random() * total;
      let idx = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].w;
        if (r <= 0) { idx = i; break; }
      }
      chosen.push(pool[idx].n);
      pool.splice(idx, 1);
    }
    return chosen.sort((a, b) => a - b);
  }

  /** Longest run of consecutive integers in a sorted set. */
  function longestRun(sorted) {
    let best = 1, run = 1;
    for (let i = 1; i < sorted.length; i++) {
      run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
      if (run > best) best = run;
    }
    return best;
  }

  /** Does this set look like the sets that historically come out? */
  function passesConstraints(set, patterns, constraints, pastKeys) {
    const c = constraints;

    if (c.excludePastDraws && pastKeys.has(set.join(','))) return false;

    if (c.enforceSum && patterns.sum.sd > 0) {
      const total = set.reduce((a, b) => a + b, 0);
      const lo = patterns.sum.mean - c.sumSigma * patterns.sum.sd;
      const hi = patterns.sum.mean + c.sumSigma * patterns.sum.sd;
      if (total < lo || total > hi) return false;
    }

    if (c.oddEven) {
      const odd = set.filter((v) => v % 2 === 1).length;
      if (odd < 2 || odd > 4) return false;
    }

    if (c.highLow) {
      const high = set.filter((v) => v > POOL / 2).length;
      if (high < 2 || high > 4) return false;
    }

    if (c.maxConsecutive && longestRun(set) > c.maxConsecutive) return false;

    if (c.minDecades) {
      const decades = new Set(set.map(TotoAnalysis.decadeOf));
      if (decades.size < c.minDecades) return false;
    }

    return true;
  }

  /**
   * Generate `count` sets.
   * Returns { sets, relaxed } — `relaxed` is true when the constraint
   * filter had to be dropped to fill the request, which happens when
   * the rules are tighter than the pool can satisfy.
   */
  function generate(analysis, pastDraws, options = {}) {
    const count = options.count ?? 5;
    const strategyKey = options.strategy ?? 'balanced';
    const bias = options.bias ?? 2;
    const constraints = { ...DEFAULT_CONSTRAINTS, ...(options.constraints || {}) };
    const strategy = STRATEGIES[strategyKey] || STRATEGIES.balanced;

    const pastKeys = new Set(
      pastDraws.map((d) => d.n.slice().sort((a, b) => a - b).join(','))
    );

    const weights =
      strategyKey === 'random'
        ? new Array(POOL).fill(1)
        : analysis.numbers.map(strategy.weight);

    const effectiveBias = strategyKey === 'random' ? 1 : bias;

    const sets = [];
    const seen = new Set();
    let attempts = 0;
    const maxAttempts = count * 400;

    while (sets.length < count && attempts < maxAttempts) {
      attempts++;
      const set = weightedPick(weights, PICK, effectiveBias);
      const key = set.join(',');
      if (seen.has(key)) continue;
      if (strategyKey !== 'random' &&
          !passesConstraints(set, analysis.patterns, constraints, pastKeys)) continue;
      seen.add(key);
      sets.push(set);
    }

    // Constraints too tight to fill the order — fall back to unfiltered
    // draws rather than silently returning fewer sets than asked for.
    let relaxed = false;
    while (sets.length < count) {
      relaxed = true;
      const set = weightedPick(weights, PICK, effectiveBias);
      const key = set.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      sets.push(set);
    }

    return {
      sets,
      relaxed,
      strategy: strategy.label,
      attempts,
    };
  }

  /** Descriptive stats for a generated set, for display alongside it. */
  function describe(set, analysis) {
    const total = set.reduce((a, b) => a + b, 0);
    const odd = set.filter((v) => v % 2 === 1).length;
    const high = set.filter((v) => v > POOL / 2).length;
    const decades = new Set(set.map(TotoAnalysis.decadeOf)).size;
    const scores = set.map((v) => analysis.numbers[v - 1].score);

    return {
      sum: total,
      sumZ: analysis.patterns.sum.sd
        ? (total - analysis.patterns.sum.mean) / analysis.patterns.sum.sd
        : 0,
      odd,
      even: PICK - odd,
      high,
      low: PICK - high,
      decades,
      avgScore: TotoAnalysis.mean(scores),
    };
  }

  return { generate, describe, STRATEGIES, DEFAULT_CONSTRAINTS, longestRun, passesConstraints };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TotoGenerator;
