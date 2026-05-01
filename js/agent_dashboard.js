/* Agent Dashboard — connects to Python FastAPI backend */
const AgentDashboard = (() => {
  const API = 'http://localhost:8000';
  let ws = null;
  let wsReconnectTimer = null;
  let state = {
    running: false,
    mode: 'paper',
    portfolio: null,
    positions: [],
    decisions: [],
    trades: [],
    stats: null,
    wsConnected: false,
    currentPrices: {},
  };

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    bindControls();
    connectWebSocket();
    loadStatus();
    loadTrades();
  }

  function bindControls() {
    document.getElementById('agentStartBtn')?.addEventListener('click', async () => {
      const mode = document.getElementById('agentModeSelect')?.value || 'paper';
      await startAgent(mode);
    });
    document.getElementById('agentStopBtn')?.addEventListener('click', stopAgent);
    document.getElementById('backtestBtn')?.addEventListener('click', runBacktest);
    document.getElementById('agentModeSelect')?.addEventListener('change', e => {
      if (e.target.value === 'live') {
        const confirmed = confirm(
          '⚠️ LIVE TRADING MODE\n\nThis will use real money on a real exchange.\nMake sure your API keys and config.yaml are set correctly.\n\nContinue?'
        );
        if (!confirmed) e.target.value = 'paper';
      }
    });
  }

  // ── API Calls ─────────────────────────────────────────────────────────────

  async function startAgent(mode) {
    try {
      const res = await fetch(`${API}/api/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.status === 'started' || data.status === 'already_running') {
        state.running = true;
        state.mode = data.mode || mode;
        updateStatusBadge();
        updateButtons();
        showToast(`Agent started in ${state.mode.toUpperCase()} mode`, 'success');
      }
    } catch (e) {
      showToast('Cannot connect to backend. Start: uvicorn main:app --reload', 'error');
    }
  }

  async function stopAgent() {
    try {
      await fetch(`${API}/api/stop`, { method: 'POST' });
      state.running = false;
      updateStatusBadge();
      updateButtons();
      showToast('Agent stopped', 'info');
    } catch (e) {
      showToast('Error stopping agent', 'error');
    }
  }

  async function loadStatus() {
    try {
      const res = await fetch(`${API}/api/status`);
      if (!res.ok) return;
      const data = await res.json();
      applyStatus(data);
    } catch (_) {
      renderOfflineState();
    }
  }

  async function loadTrades() {
    try {
      const res = await fetch(`${API}/api/trades?limit=50`);
      if (!res.ok) return;
      state.trades = await res.json();
      renderTrades();
    } catch (_) {}
  }

  async function runBacktest() {
    const btn = document.getElementById('backtestBtn');
    if (btn) { btn.textContent = 'Running...'; btn.disabled = true; }
    try {
      const pairs = state.currentPrices && Object.keys(state.currentPrices).length
        ? Object.keys(state.currentPrices).slice(0, 2)
        : ['BTC/USDT'];
      const res = await fetch(`${API}/api/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs, initial_balance: 10000, timeframe: '1h' }),
      });
      const job = await res.json();
      pollBacktest(job.job_id);
    } catch (e) {
      showToast('Backtest failed — is the backend running?', 'error');
      if (btn) { btn.textContent = 'Run Backtest'; btn.disabled = false; }
    }
  }

  async function pollBacktest(jobId) {
    const btn = document.getElementById('backtestBtn');
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      try {
        const res = await fetch(`${API}/api/backtest/${jobId}`);
        const job = await res.json();
        if (job.status === 'completed') {
          renderBacktestResults(job.results);
          if (btn) { btn.textContent = 'Run Backtest'; btn.disabled = false; }
          return;
        }
        if (job.status === 'failed') {
          showToast(`Backtest failed: ${job.error}`, 'error');
          if (btn) { btn.textContent = 'Run Backtest'; btn.disabled = false; }
          return;
        }
      } catch (_) {}
    }
    if (btn) { btn.textContent = 'Run Backtest'; btn.disabled = false; }
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────

  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    ws = new WebSocket(`ws://localhost:8000/ws`);

    ws.onopen = () => {
      state.wsConnected = true;
      updateWsIndicator();
      clearTimeout(wsReconnectTimer);
    };

    ws.onclose = () => {
      state.wsConnected = false;
      updateWsIndicator();
      wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = () => {
      state.wsConnected = false;
      updateWsIndicator();
    };

    ws.onmessage = e => {
      try { handleWsMessage(JSON.parse(e.data)); } catch (_) {}
    };
  }

  function handleWsMessage(msg) {
    switch (msg.type) {
      case 'tick_complete':
        applyStatus(msg.data);
        break;
      case 'ai_decision':
        prependDecision(msg.data);
        break;
      case 'position_opened':
        showToast(`🟢 BUY ${msg.data.pair} @ $${fmtNum(msg.data.price)}`, 'success');
        loadStatus();
        break;
      case 'position_closed':
        const pnlStr = msg.data.pnl !== undefined ? ` PnL: ${msg.data.pnl > 0 ? '+' : ''}$${fmtNum(msg.data.pnl)}` : '';
        showToast(`🔴 CLOSED ${msg.data.pair} (${msg.data.reason})${pnlStr}`, msg.data.pnl > 0 ? 'success' : 'error');
        loadStatus();
        loadTrades();
        break;
      case 'price_update':
        state.currentPrices = msg.data;
        break;
      case 'agent_started':
        state.running = true;
        state.mode = msg.data.mode;
        updateStatusBadge();
        updateButtons();
        break;
      case 'agent_stopped':
        state.running = false;
        updateStatusBadge();
        updateButtons();
        break;
      case 'agent_halted':
        state.running = false;
        updateStatusBadge('halted');
        showToast(`⛔ Agent halted: ${msg.data.reason}`, 'error');
        break;
      case 'error':
        showToast(`Agent error: ${msg.data.message}`, 'error');
        break;
    }
  }

  // ── State Application ─────────────────────────────────────────────────────

  function applyStatus(data) {
    state.running = data.running;
    state.mode = data.mode;
    if (data.portfolio) state.portfolio = data.portfolio;
    if (data.stats) state.stats = data.stats;
    if (data.current_prices) state.currentPrices = data.current_prices;

    // Positions from status
    if (data.positions) state.positions = data.positions;

    updateStatusBadge();
    updateButtons();
    renderPortfolioMetrics();
    renderPositions();
  }

  function renderOfflineState() {
    const el = document.getElementById('agentStatusBadge');
    if (el) { el.textContent = 'OFFLINE'; el.className = 'agent-status-badge'; }
    const hint = document.getElementById('agentOfflineHint');
    if (hint) hint.style.display = 'block';
  }

  // ── Render Functions ──────────────────────────────────────────────────────

  function updateStatusBadge(override) {
    const el = document.getElementById('agentStatusBadge');
    if (!el) return;
    if (override === 'halted') {
      el.textContent = 'HALTED'; el.className = 'agent-status-badge halted';
    } else if (state.running) {
      el.textContent = `RUNNING (${state.mode.toUpperCase()})`;
      el.className = 'agent-status-badge running';
    } else {
      el.textContent = 'STOPPED'; el.className = 'agent-status-badge';
    }
  }

  function updateButtons() {
    const startBtn = document.getElementById('agentStartBtn');
    const stopBtn = document.getElementById('agentStopBtn');
    const modeSelect = document.getElementById('agentModeSelect');
    if (startBtn) startBtn.disabled = state.running;
    if (stopBtn) stopBtn.disabled = !state.running;
    if (modeSelect) modeSelect.disabled = state.running;
  }

  function updateWsIndicator() {
    const el = document.getElementById('wsIndicator');
    if (!el) return;
    el.className = 'ws-indicator' + (state.wsConnected ? ' connected' : '');
    el.title = state.wsConnected ? 'WebSocket connected' : 'WebSocket disconnected';
  }

  function renderPortfolioMetrics() {
    const p = state.portfolio;
    const stats = state.stats;
    if (!p) return;

    setText('portfolioValue', `$${fmtNum(p.total_value)}`);
    setText('availableBalance', `$${fmtNum(p.available_balance)}`);

    const pnlEl = document.getElementById('dailyPnl');
    if (pnlEl) {
      const pct = (p.daily_pnl_pct || 0);
      pnlEl.textContent = `${pct >= 0 ? '+' : ''}$${fmtNum(p.daily_pnl)} (${pct >= 0 ? '+' : ''}${fmtPct(pct)}%)`;
      pnlEl.style.color = pct >= 0 ? 'var(--green)' : 'var(--red)';
    }

    const posCount = Object.keys(state.currentPrices).length > 0
      ? state.positions.length : (p.open_positions || state.positions.length);
    setText('openPositions', posCount + ' open');

    if (stats) {
      const wr = stats.win_rate * 100;
      const wrEl = document.getElementById('winRate');
      if (wrEl) {
        wrEl.textContent = `${wr.toFixed(1)}% (${stats.winning_trades}/${stats.total_trades})`;
        wrEl.style.color = wr >= 50 ? 'var(--green)' : 'var(--red)';
      }
    }
  }

  function renderPositions() {
    const container = document.getElementById('positionsContent');
    if (!container) return;

    if (!state.positions.length) {
      container.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px">No open positions</p>';
      return;
    }

    container.innerHTML = state.positions.map(pos => {
      const pnlColor = (pos.unrealized_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)';
      const pnlSign = (pos.unrealized_pnl || 0) >= 0 ? '+' : '';
      const sinceMs = pos.opened_at ? Date.now() - new Date(pos.opened_at).getTime() : 0;
      const sinceStr = sinceMs > 0 ? fmtDuration(sinceMs) : '—';
      return `
        <div class="position-row">
          <div>
            <div style="font-weight:700">${esc(pos.pair)}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${pos.side.toUpperCase()} · ${sinceStr}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:.8rem;color:var(--text-muted)">Entry / Current</div>
            <div style="font-size:.85rem">$${fmtNum(pos.entry_price)} → $${fmtNum(pos.current_price || pos.entry_price)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:${pnlColor}">${pnlSign}$${fmtNum(pos.unrealized_pnl || 0)}</div>
            <div style="font-size:.75rem;color:${pnlColor}">${pnlSign}${fmtPct(pos.pnl_pct || 0)}%</div>
          </div>
          <div style="text-align:right;font-size:.72rem;color:var(--text-muted)">
            <div>SL $${fmtNum(pos.stop_loss)}</div>
            <div>TP $${fmtNum(pos.take_profit)}</div>
          </div>
        </div>`;
    }).join('');
  }

  function prependDecision(data) {
    state.decisions.unshift(data);
    if (state.decisions.length > 30) state.decisions.pop();
    renderDecisions();
  }

  function renderDecisions() {
    const container = document.getElementById('decisionsContent');
    if (!container) return;
    if (!state.decisions.length) {
      container.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px">Waiting for first agent tick…</p>';
      return;
    }
    container.innerHTML = state.decisions.slice(0, 15).map(d => {
      const confidence = Math.round((d.confidence || 0) * 100);
      const ts = d.ts ? new Date(d.ts).toLocaleTimeString() : '';
      const signals = (d.supporting_signals || []).slice(0, 2).join(', ');
      return `
        <div class="decision-entry ${d.action}">
          <div class="decision-header">
            <span class="signal-badge ${d.action === 'buy' ? 'bullish' : d.action === 'sell' ? 'bearish' : 'neutral'}">${d.action.toUpperCase()}</span>
            <strong>${esc(d.pair)}</strong>
            <span style="font-size:.75rem;color:var(--text-muted);margin-left:auto">${ts}</span>
          </div>
          <div class="confidence-bar" title="Confidence: ${confidence}%">
            <div class="confidence-fill" style="width:${confidence}%;background:${d.action === 'buy' ? 'var(--green)' : d.action === 'sell' ? 'var(--red)' : 'var(--yellow)'}"></div>
          </div>
          <div class="decision-reasoning" style="margin-top:6px">${esc(d.reasoning || '')}</div>
          ${signals ? `<div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">✓ ${esc(signals)}</div>` : ''}
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">TA: ${d.ta_verdict ? d.ta_verdict.toUpperCase() : '—'} (${d.ta_score ?? '—'}/100) · Confidence: ${confidence}%</div>
        </div>`;
    }).join('');
  }

  function renderTrades() {
    const container = document.getElementById('tradesContent');
    if (!container) return;
    if (!state.trades.length) {
      container.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px">No trades yet</p>';
      return;
    }
    container.innerHTML = `
      <table class="markets-table" style="font-size:.82rem">
        <thead><tr>
          <th>Pair</th><th>Side</th><th>Entry</th><th>Exit</th>
          <th>PnL</th><th>Reason</th><th>Opened</th>
        </tr></thead>
        <tbody>
          ${state.trades.slice(0, 50).map(t => {
            const pnlColor = (t.pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)';
            const pnlSign = (t.pnl || 0) >= 0 ? '+' : '';
            const openDate = t.opened_at ? new Date(t.opened_at).toLocaleDateString() : '—';
            return `<tr>
              <td><strong>${esc(t.pair)}</strong></td>
              <td><span class="signal-badge ${t.side === 'buy' ? 'bullish' : 'bearish'}">${t.side.toUpperCase()}</span></td>
              <td>$${fmtNum(t.entry_price)}</td>
              <td>${t.exit_price ? '$' + fmtNum(t.exit_price) : '<span class="text-muted">OPEN</span>'}</td>
              <td style="color:${pnlColor}">${t.pnl !== null && t.pnl !== undefined ? pnlSign + '$' + fmtNum(t.pnl) : '—'}</td>
              <td style="color:var(--text-muted);font-size:.72rem">${esc(t.close_reason || t.status)}</td>
              <td style="color:var(--text-muted)">${openDate}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function renderBacktestResults(results) {
    const panel = document.getElementById('backtestResults');
    const content = document.getElementById('backtestContent');
    if (!panel || !content || !results) return;
    panel.classList.remove('hidden');

    content.innerHTML = results.map(r => {
      if (r.error) return `<p class="text-danger">${esc(r.error)}</p>`;
      const retColor = r.total_return_pct >= 0 ? 'var(--green)' : 'var(--red)';
      return `
        <div style="margin-bottom:16px">
          <h4 style="margin-bottom:12px">${esc(r.pair)}</h4>
          <div class="agent-metrics-row" style="margin-bottom:12px">
            <div class="metric-card">
              <div class="metric-label">Total Return</div>
              <div class="metric-value" style="color:${retColor}">${r.total_return_pct >= 0 ? '+' : ''}${r.total_return_pct.toFixed(2)}%</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Final Balance</div>
              <div class="metric-value">$${fmtNum(r.final_balance)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Win Rate</div>
              <div class="metric-value">${(r.win_rate * 100).toFixed(1)}%</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Total Trades</div>
              <div class="metric-value">${r.total_trades}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Max Drawdown</div>
              <div class="metric-value" style="color:var(--red)">-${r.max_drawdown_pct.toFixed(2)}%</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Sharpe Ratio</div>
              <div class="metric-value" style="color:${r.sharpe_ratio >= 1 ? 'var(--green)' : 'var(--yellow)'}">${r.sharpe_ratio.toFixed(3)}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function fmtNum(n) {
    if (n === null || n === undefined) return '—';
    const num = parseFloat(n);
    if (isNaN(num)) return '—';
    if (Math.abs(num) >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (Math.abs(num) >= 1) return num.toFixed(4);
    return num.toFixed(6);
  }

  function fmtPct(n) { return parseFloat(n || 0).toFixed(2); }

  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showToast(msg, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(msg, type);
    } else {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = msg;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.className = 'toast', 3500);
      }
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { init };
})();
