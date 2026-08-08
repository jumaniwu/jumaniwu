/* ============================================================
   toto.js — UI controller for the TOTO analyser
   ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    draws: [],
    source: 'seed',
    analysis: null,
    charts: {},
  };

  /* ---------- current control values ---------- */

  function readOptions() {
    return {
      halfLife: +$('halfLife').value,
      weights: {
        frequency: +$('wFreq').value / 100,
        overdue: +$('wOver').value / 100,
        recency: +$('wRec').value / 100,
        pair: +$('wPair').value / 100,
      },
    };
  }

  function readConstraints() {
    return {
      enforceSum: $('cSum').checked,
      sumSigma: 1.5,
      oddEven: $('cOdd').checked,
      highLow: $('cHigh').checked,
      maxConsecutive: $('cRun').checked ? 2 : 0,
      minDecades: $('cDec').checked ? 3 : 0,
      excludePastDraws: $('cPast').checked,
    };
  }

  /* ---------- pipeline ---------- */

  function recompute() {
    state.analysis = TotoAnalysis.analyze(state.draws, readOptions());
    renderStatsBar();
    // Rendering the analysis pulls in charts, which depend on a CDN. Keep
    // a failure there from taking the history table down with it.
    try {
      renderAnalysis();
    } catch (err) {
      console.error('Analysis rendering failed:', err);
    }
    renderHistory();
  }

  /* ---------- stats bar ---------- */

  function renderStatsBar() {
    const a = state.analysis;
    $('statDraws').textContent = a.drawCount;
    $('statWindow').textContent = a.dateRange
      ? `${a.dateRange.from} → ${a.dateRange.to}`
      : '—';
    $('statSource').textContent =
      state.source === 'imported' ? 'Imported' : 'Bundled seed';
    $('statSum').textContent = a.patterns.sum.mean
      ? `${a.patterns.sum.mean.toFixed(1)} ± ${a.patterns.sum.sd.toFixed(1)}`
      : '—';

    const chi = TotoAnalysis.chiSquare(a.numbers, a.drawCount);
    const el = $('statChi');
    el.textContent = chi.biased ? `χ² ${chi.stat.toFixed(1)} — wide` : `χ² ${chi.stat.toFixed(1)} — fair`;
    el.className = 'stat-value ' + (chi.biased ? 'text-yellow' : 'text-green');
    el.title = chi.interpretation;
  }

  /* ---------- generator ---------- */

  function renderStrategies() {
    const sel = $('strategySelect');
    sel.innerHTML = Object.entries(TotoGenerator.STRATEGIES)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join('');
    updateBlurb();
  }

  function updateBlurb() {
    const key = $('strategySelect').value;
    $('strategyBlurb').textContent = TotoGenerator.STRATEGIES[key].blurb;
  }

  function generate() {
    if (!state.analysis || !state.draws.length) return;

    const result = TotoGenerator.generate(state.analysis, state.draws, {
      count: +$('setCount').value,
      strategy: $('strategySelect').value,
      bias: +$('bias').value / 10,
      constraints: readConstraints(),
    });

    const notice = $('genNotice');
    if (result.relaxed) {
      notice.className = 'notice notice-warn';
      notice.textContent =
        'Your shape filters were too restrictive to fill that many unique sets, so some were generated without them. Loosen a filter or ask for fewer sets.';
    } else {
      notice.className = 'notice hidden';
    }

    $('ticketList').innerHTML = result.sets
      .map((set, i) => {
        const d = TotoGenerator.describe(set, state.analysis);
        const balls = set
          .map((n) => {
            const s = state.analysis.numbers[n - 1];
            const heat =
              s.zScore > 0.8 ? 'ball-hot' : s.zScore < -0.8 ? 'ball-cold' : '';
            return `<span class="ball ${heat}" title="Drawn ${s.count}× · gap ${s.gap} · score ${s.score.toFixed(2)}">${String(n).padStart(2, '0')}</span>`;
          })
          .join('');
        return `
          <div class="ticket">
            <div class="ticket-head">
              <span class="ticket-idx">Set ${i + 1}</span>
              <span class="ticket-score">avg score ${d.avgScore.toFixed(3)}</span>
            </div>
            <div class="ticket-balls">${balls}</div>
            <div class="ticket-meta">
              <span>Sum <b>${d.sum}</b> <i>(${d.sumZ >= 0 ? '+' : ''}${d.sumZ.toFixed(2)}σ)</i></span>
              <span>Odd/Even <b>${d.odd}/${d.even}</b></span>
              <span>Low/High <b>${d.low}/${d.high}</b></span>
              <span>Bands <b>${d.decades}</b></span>
            </div>
          </div>`;
      })
      .join('');
  }

  /* ---------- backtest ---------- */

  function runBacktest() {
    const out = $('backtestOut');
    out.innerHTML = '<div class="empty-state">Running…</div>';

    // Yield to the browser so the "Running…" state paints first.
    setTimeout(() => {
      const opts = readOptions();
      const constraints = readConstraints();
      const strategy = $('strategySelect').value;
      const bias = +$('bias').value / 10;

      const generateFn = (trainDraws, count) => {
        const a = TotoAnalysis.analyze(trainDraws, opts);
        return TotoGenerator.generate(a, trainDraws, {
          count,
          strategy,
          bias,
          constraints,
        }).sets;
      };

      // 100 sets per draw keeps the Monte Carlo error small enough that
      // the comparison reflects the model rather than sampling noise.
      const SETS_PER_DRAW = 100;
      const r = TotoAnalysis.backtest(state.draws, generateFn, {
        minTrain: 15,
        setsPerDraw: SETS_PER_DRAW,
      });

      if (!r.ran) {
        out.innerHTML = `<div class="notice notice-warn">${r.reason}</div>`;
        return;
      }

      const row = (label, s, cls = '') => `
        <tr class="${cls}">
          <td>${label}</td>
          <td class="mono">${s.avgMatches.toFixed(4)}</td>
          <td class="mono">${s.sets.toLocaleString()}</td>
          <td class="mono">${s.threePlus} <i>(${((s.threePlus / s.sets) * 100).toFixed(2)}%)</i></td>
          <td class="mono">${s.fourPlus} <i>(${((s.fourPlus / s.sets) * 100).toFixed(2)}%)</i></td>
        </tr>`;

      out.innerHTML = `
        <div class="backtest-summary">
          Tested against <b>${r.drawsTested}</b> real draws, ${SETS_PER_DRAW} sets per draw per method.
        </div>
        <div class="table-wrap">
          <table class="draw-table">
            <thead>
              <tr><th>Method</th><th>Avg matches / set</th><th>Sets</th><th>3+ hits</th><th>4+ hits</th></tr>
            </thead>
            <tbody>
              ${row('Weighted model', r.model, 'row-accent')}
              ${row('Pure random', r.random)}
            </tbody>
          </table>
        </div>
        <div class="backtest-verdict ${r.significant ? 'warn' : 'ok'}">
          <b>Theoretical expectation for any method: ${r.theoretical.toFixed(4)} matches per set.</b><br />
          ${r.verdict}
        </div>`;
    }, 30);
  }

  /* ---------- analysis rendering ---------- */

  function rankList(items, valueFn, subFn) {
    return items
      .map(
        (s) => `
        <div class="rank-row">
          <span class="ball ball-sm">${String(s.n).padStart(2, '0')}</span>
          <span class="rank-val">${valueFn(s)}</span>
          <span class="rank-sub">${subFn(s)}</span>
        </div>`
      )
      .join('');
  }

  function renderAnalysis() {
    const a = state.analysis;

    $('hotList').innerHTML = rankList(
      a.hot,
      (s) => `${s.count}×`,
      (s) => `${s.zScore >= 0 ? '+' : ''}${s.zScore.toFixed(2)}σ`
    );
    $('coldList').innerHTML = rankList(
      a.cold,
      (s) => `${s.count}×`,
      (s) => `${s.zScore >= 0 ? '+' : ''}${s.zScore.toFixed(2)}σ`
    );
    $('overdueList').innerHTML = rankList(
      a.overdue,
      (s) => `${s.gap} draw${s.gap === 1 ? '' : 's'}`,
      (s) => `${s.overdueRatio.toFixed(2)}× avg`
    );

    const p = a.patterns;
    const chi = TotoAnalysis.chiSquare(a.numbers, a.drawCount);
    $('patternGrid').innerHTML = `
      <div class="pat"><span>Mean sum</span><b>${p.sum.mean.toFixed(1)}</b></div>
      <div class="pat"><span>Sum range</span><b>${p.sum.min}–${p.sum.max}</b></div>
      <div class="pat"><span>Sum σ</span><b>${p.sum.sd.toFixed(1)}</b></div>
      <div class="pat"><span>Draws with consecutive pair</span><b>${(p.consecutiveRate * 100).toFixed(0)}%</b></div>
      <div class="pat"><span>Avg repeats from previous draw</span><b>${p.repeatMean.toFixed(2)}</b></div>
      <div class="pat"><span>Expected hits per number</span><b>${a.expectedPerNumber.toFixed(2)}</b></div>
      <div class="pat pat-wide"><span>Uniformity test</span><b class="${chi.biased ? 'text-yellow' : 'text-green'}">${chi.interpretation}</b></div>`;

    $('pairList').innerHTML = a.topPairs
      .map(
        (pr) => `
        <div class="pair">
          <span class="ball ball-sm">${String(pr.a).padStart(2, '0')}</span>
          <span class="ball ball-sm">${String(pr.b).padStart(2, '0')}</span>
          <span class="pair-count">${pr.count}×</span>
        </div>`
      )
      .join('');

    drawCharts();
  }

  /* ---------- charts ---------- */

  const CHART_BASE = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#1e2235' }, ticks: { color: '#8b90a8', font: { size: 9 } } },
      y: { grid: { color: '#1e2235' }, ticks: { color: '#8b90a8', font: { size: 10 } } },
    },
  };

  function makeChart(id, config) {
    if (state.charts[id]) state.charts[id].destroy();
    state.charts[id] = new Chart($(id), config);
  }

  /** Charts come from a CDN. If it is unreachable, say so and carry on —
   *  they illustrate the numbers, they aren't the product. */
  function chartsUnavailable() {
    document.querySelectorAll('.chart-wrap').forEach((el) => {
      el.innerHTML =
        '<div class="chart-fallback">Charts need the Chart.js CDN, which this browser could not reach. Every figure below is unaffected.</div>';
    });
  }

  function drawCharts() {
    if (typeof Chart === 'undefined') {
      chartsUnavailable();
      return;
    }
    const a = state.analysis;
    const labels = a.numbers.map((s) => s.n);

    makeChart('freqChart', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: a.numbers.map((s) => s.count),
            backgroundColor: a.numbers.map((s) =>
              s.zScore > 0.8 ? '#00d68f' : s.zScore < -0.8 ? '#ff4d6a' : '#6c63ff'
            ),
            borderRadius: 2,
          },
          {
            type: 'line',
            data: labels.map(() => a.expectedPerNumber),
            borderColor: '#ffd166',
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
          },
        ],
      },
      options: CHART_BASE,
    });

    makeChart('scoreChart', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: a.numbers.map((s) => s.score),
            backgroundColor: '#6c63ff',
            borderRadius: 2,
          },
        ],
      },
      options: CHART_BASE,
    });

    makeChart('oddChart', {
      type: 'bar',
      data: {
        labels: a.patterns.oddHist.map((_, i) => `${i} odd`),
        datasets: [{ data: a.patterns.oddHist, backgroundColor: '#6c63ff', borderRadius: 3 }],
      },
      options: CHART_BASE,
    });

    makeChart('decadeChart', {
      type: 'bar',
      data: {
        labels: ['1–10', '11–20', '21–30', '31–40', '41–49'],
        datasets: [{ data: a.patterns.decadeHist, backgroundColor: '#00d68f', borderRadius: 3 }],
      },
      options: CHART_BASE,
    });
  }

  /* ---------- history table ---------- */

  function renderHistory() {
    $('historyBody').innerHTML = state.draws
      .map((d) => {
        const odd = d.n.filter((v) => v % 2 === 1).length;
        return `
        <tr>
          <td class="mono">${d.draw ?? '—'}</td>
          <td class="mono">${d.date ?? '—'}</td>
          <td>${d.n.map((n) => `<span class="ball ball-sm">${String(n).padStart(2, '0')}</span>`).join('')}</td>
          <td>${d.a == null ? '<span class="mono">—</span>' : `<span class="ball ball-sm ball-add">${String(d.a).padStart(2, '0')}</span>`}</td>
          <td class="mono">${d.n.reduce((x, y) => x + y, 0)}</td>
          <td class="mono">${odd}/${6 - odd}</td>
        </tr>`;
      })
      .join('');

    const note = $('coverageNote');
    if (state.source === 'imported') {
      note.className = 'notice hidden';
    } else {
      const range = state.analysis.dateRange;
      note.className = 'notice notice-warn';
      note.innerHTML = `Showing the bundled seed set: <b>${state.draws.length} verified draws</b>
        spanning ${range ? `${range.from} to ${range.to}` : 'an unknown window'}.
        Complete official history could not be fetched from this environment, so
        ${TOTO_MISSING_DRAWS.length} known draws in this window are missing
        (${TOTO_MISSING_DRAWS.slice(0, 8).join(', ')}…).
        Use <b>Manage data</b> to paste a full 12-month history.`;
    }
  }

  /* ---------- import ---------- */

  /**
   * Parses free-form pasted results, one draw per line.
   *
   * Rather than assuming a fixed column order, this pulls every integer
   * out of the line and looks for the first run of 7 consecutive values
   * that could actually be a draw: all within 1..49, with the first six
   * distinct. That survives leading draw numbers, "+" separators, and
   * trailing junk such as prize amounts, which a positional parser
   * would misread.
   */
  function parseDraws(text) {
    const draws = [];
    const errors = [];

    text.split(/\r?\n/).forEach((line, idx) => {
      const raw = line.trim();
      if (!raw) return;

      // Header rows are identified by carrying several column words, not
      // by their first word: plenty of real rows begin with "Draw", and a
      // labelled row like "Draw 4205 Date ... Additional 11" is data. This
      // is only consulted after a real parse has failed.
      const headerWords =
        raw.match(/\b(draw|date|no|s\/n|additional|winning|numbers?|results?|sum|jackpot|prize)\b/gi) || [];
      const headerish = headerWords.length >= 2;

      // Pull out a date first so its digits can't be mistaken for balls.
      let date = null;
      let rest = raw;

      const iso = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      const dmy = raw.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
      if (iso) {
        date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
        rest = raw.replace(iso[0], ' ');
      } else if (dmy) {
        date = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
        rest = raw.replace(dmy[0], ' ');
      }

      const nums = (rest.match(/\d+/g) || []).map(Number);
      const isBall = (v) => Number.isInteger(v) && v >= 1 && v <= 49;

      let start = -1;
      for (let i = 0; i + 7 <= nums.length; i++) {
        const win = nums.slice(i, i + 7);
        if (win.every(isBall) && new Set(win.slice(0, 6)).size === 6) {
          start = i;
          break;
        }
      }

      if (start !== -1) {
        // Anything before the run that is too large to be a ball is the
        // draw number.
        const lead = nums.slice(0, start).filter((v) => v > 49);
        draws.push({
          draw: lead.length ? lead[0] : null,
          date,
          n: nums.slice(start, start + 6).sort((a, b) => a - b),
          a: nums[start + 6],
        });
        return;
      }

      if (headerish) return; // a genuine header row: skip without complaint

      // Fallback for exports that carry the 6 winners but no additional
      // number. Deliberately restricted to lines holding exactly six
      // values, so a malformed 7-value row still reports an error instead
      // of quietly parsing as a 6-value one.
      const body = nums.length && nums[0] > 49 ? nums.slice(1) : nums;
      if (body.length === 6 && body.every(isBall) && new Set(body).size === 6) {
        draws.push({
          draw: nums[0] > 49 ? nums[0] : null,
          date,
          n: body.slice().sort((a, b) => a - b),
          a: null,
        });
        return;
      }

      errors.push(
        `Line ${idx + 1}: could not read 6 winning numbers (1–49, distinct) — found ${nums.length} value(s).`
      );
    });

    return { draws, errors };
  }

  function applyImport(replace) {
    const { draws, errors } = parseDraws($('importText').value);
    const fb = $('importFeedback');

    if (!draws.length) {
      fb.className = 'import-feedback err';
      fb.innerHTML = `Nothing imported.<br />${errors.slice(0, 6).join('<br />')}`;
      return;
    }

    const merged = replace ? draws : TotoData.dedupe([...draws, ...state.draws]);
    const sorted = TotoData.sort(merged);

    TotoData.save(sorted);
    state.draws = sorted;
    state.source = 'imported';
    recompute();

    fb.className = 'import-feedback ok';
    fb.innerHTML =
      `Loaded ${draws.length} draw${draws.length === 1 ? '' : 's'}; ${sorted.length} now in the analysis.` +
      (errors.length ? `<br /><span class="warn-text">${errors.length} line(s) skipped: ${errors.slice(0, 4).join(' ')}</span>` : '');
  }

  function resetData() {
    TotoData.clear();
    const loaded = TotoData.load();
    state.draws = loaded.draws;
    state.source = loaded.source;
    recompute();
    const fb = $('importFeedback');
    fb.className = 'import-feedback ok';
    fb.textContent = `Reset to the bundled ${state.draws.length}-draw seed set.`;
  }

  /* ---------- wiring ---------- */

  function bindSlider(id, valId, fmt) {
    $(id).addEventListener('input', () => {
      $(valId).textContent = fmt(+$(id).value);
      recompute();
    });
  }

  function init() {
    const loaded = TotoData.load();
    state.draws = loaded.draws;
    state.source = loaded.source;

    renderStrategies();

    // Bind before the first render, so a rendering fault can never leave
    // the page with dead controls.
    $('strategySelect').addEventListener('change', updateBlurb);
    $('generateBtn').addEventListener('click', generate);
    $('backtestBtn').addEventListener('click', runBacktest);

    $('setCount').addEventListener('input', () => {
      $('setCountVal').textContent = $('setCount').value;
    });
    $('bias').addEventListener('input', () => {
      $('biasVal').textContent = (+$('bias').value / 10).toFixed(1);
    });

    bindSlider('halfLife', 'halfLifeVal', (v) => v);
    bindSlider('wFreq', 'wFreqVal', (v) => (v / 100).toFixed(2));
    bindSlider('wOver', 'wOverVal', (v) => (v / 100).toFixed(2));
    bindSlider('wRec', 'wRecVal', (v) => (v / 100).toFixed(2));
    bindSlider('wPair', 'wPairVal', (v) => (v / 100).toFixed(2));

    // Data modal
    $('dataBtn').addEventListener('click', () => $('dataModal').classList.remove('hidden'));
    $('closeModal').addEventListener('click', () => $('dataModal').classList.add('hidden'));
    $('dataModal').addEventListener('click', (e) => {
      if (e.target.id === 'dataModal') $('dataModal').classList.add('hidden');
    });
    $('replaceBtn').addEventListener('click', () => applyImport(true));
    $('appendBtn').addEventListener('click', () => applyImport(false));
    $('resetBtn').addEventListener('click', resetData);

    $('csvFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { $('importText').value = reader.result; };
      reader.readAsText(file);
    });

    recompute();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
