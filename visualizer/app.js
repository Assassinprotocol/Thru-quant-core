/**
 * Thru Quant Core — Developer Telemetry & Oracle Console
 * Connects directly to Go API daemon (/v1/stream with SSE, auto-fallback to REST /v1/oracle/latest)
 */

// Application State
const state = {
    connected: false,
    connectionMode: 'DISCONNECTED', // 'SSE', 'POLLING', 'DISCONNECTED'
    sourceMode: 'INITIALIZING',
    slot: 0,
    lastUpdateTS: 0,
    circuitBreakerActive: false,
    regimeId: 0,
    authority: '',
    programId: '',
    accountId: '',
    entries: [],
    prevPrices: {},
    q64Mode: 'HEX', // 'HEX' or 'DEC'
    searchQuery: '',
    eventSource: null,
    pollTimer: null,
    ageTimer: null,
    rawStateJSON: null
};

// Canonical Regime names
const REGIMES = {
    0: 'NEUTRAL / RANGING',
    1: 'TRENDING UP (BULLISH)',
    2: 'TRENDING DOWN (BEARISH)',
    3: 'VOLATILE / EXPANSION',
    4: 'COMPRESSION / SQUEEZE'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initAgeTicker();
    initSearchFilter();
    initOrderbook();
    initDeveloperHelpers();
    initTelemetryLoop();
    connectSSE();
});

// Telemetry & Readiness Monitor Loop
function initTelemetryLoop() {
    checkReadiness();
    fetchStatusMetrics();
    setInterval(() => {
        checkReadiness();
        fetchStatusMetrics();
    }, 3500);
}

async function checkReadiness() {
    const pill = document.getElementById('readyPill');
    if (!pill) return;
    try {
        const res = await fetch('/ready');
        const data = await res.json();
        if (res.ok && data.ready) {
            pill.className = 'status-pill ready-ok';
            pill.innerHTML = '<span class="dot-pulse"></span> READY: 200';
        } else {
            pill.className = 'status-pill ready-degraded';
            pill.innerHTML = `<span class="dot-pulse"></span> DEGRADED (${data.status.toUpperCase()})`;
        }
    } catch (e) {
        pill.className = 'status-pill stream-disconnected';
        pill.innerHTML = '<span class="dot-pulse"></span> READY: OFFLINE';
    }
}

async function fetchStatusMetrics() {
    try {
        const res = await fetch('/v1/status');
        if (!res.ok) return;
        const data = await res.json();
        if (data.operational_metrics) {
            const m = data.operational_metrics;
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val.toLocaleString();
            };
            setVal('opReqsTotal', m.requests_total || 0);
            setVal('opUpdatesTotal', m.oracle_updates_total || 0);
            setVal('opRpcFailures', m.rpc_failures_total || 0);
            setVal('opStaleDiscards', m.stale_discards_total || 0);
            setVal('opBreakerTrips', m.circuit_breaker_trips_total || 0);
        }
    } catch (e) {
        // Silent ignore on poll failure
    }
}

// SSE Connection Manager with Auto-Reconnect & REST Polling Fallback
function connectSSE() {
    if (state.eventSource) {
        state.eventSource.close();
    }

    setConnectionStatus('CONNECTING...', 'stream-polling');

    try {
        state.eventSource = new EventSource('/v1/stream');

        state.eventSource.addEventListener('open', () => {
            state.connected = true;
            state.connectionMode = 'SSE';
            setConnectionStatus('LIVE SSE STREAM', 'stream-live');
            if (state.pollTimer) {
                clearInterval(state.pollTimer);
                state.pollTimer = null;
            }
        });

        state.eventSource.addEventListener('oracle_state', (e) => {
            try {
                const data = JSON.parse(e.data);
                handleNewOracleState(data);
            } catch (err) {
                console.error('[SSE] Failed parsing oracle_state payload:', err);
            }
        });

        state.eventSource.onerror = (err) => {
            console.warn('[SSE] Connection error or server restarting, falling back to polling...', err);
            state.connected = false;
            if (state.eventSource) {
                state.eventSource.close();
                state.eventSource = null;
            }
            startPollingFallback();
        };

    } catch (e) {
        console.error('[SSE] Initialization error:', e);
        startPollingFallback();
    }
}

function startPollingFallback() {
    state.connectionMode = 'POLLING';
    setConnectionStatus('POLLING FALLBACK (2.5s)', 'stream-polling');

    // Fetch immediately
    fetchLatestREST();

    if (!state.pollTimer) {
        state.pollTimer = setInterval(fetchLatestREST, 2500);
    }

    // Try reconnecting to SSE every 12 seconds
    setTimeout(() => {
        if (state.connectionMode === 'POLLING') {
            console.log('[SSE] Retrying live stream connection...');
            connectSSE();
        }
    }, 12000);
}

async function fetchLatestREST() {
    try {
        const res = await fetch('/v1/oracle/latest');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.connected = true;
        handleNewOracleState(data);
    } catch (err) {
        console.warn('[REST] Polling fetch error:', err);
        state.connected = false;
        setConnectionStatus('DISCONNECTED (API Offline)', 'stream-disconnected');
    }
}

// State Processor & UI Dispatcher
function handleNewOracleState(data) {
    if (!data) return;

    state.rawStateJSON = data;
    state.sourceMode = data.source_mode || 'UNKNOWN';
    state.slot = data.slot || 0;
    state.lastUpdateTS = data.last_update_ts || 0;
    state.circuitBreakerActive = !!data.circuit_breaker_active;
    state.regimeId = data.regime_id || 0;
    state.authority = data.authority || '';
    state.programId = data.program_id || '';
    state.accountId = data.account_id || '';

    const newEntries = data.entries || [];
    renderHeaderMetadata();
    renderBentoMetrics(newEntries);
    renderCircuitBreakerBanner();
    renderOracleTable(newEntries);
    renderRawJSON();

    // Store prices for flash delta calculation on next tick
    newEntries.forEach(e => {
        state.prevPrices[e.symbol] = e.price;
    });
}

// Render Functions
function setConnectionStatus(text, className) {
    const pill = document.getElementById('connectionPill');
    if (!pill) return;
    pill.className = `status-pill ${className}`;
    pill.innerHTML = `<span class="dot-pulse"></span> ${text}`;
}

function renderHeaderMetadata() {
    const sourcePill = document.getElementById('sourcePill');
    if (sourcePill) {
        const isFailover = state.sourceMode.includes('FAILOVER');
        sourcePill.className = `status-pill ${isFailover ? 'source-failover' : 'source-onchain'}`;
        sourcePill.textContent = `SOURCE: ${state.sourceMode}`;
    }

    const slotVal = document.getElementById('metaSlotVal');
    if (slotVal) slotVal.textContent = state.slot ? state.slot.toLocaleString() : 'N/A';

    const accountVal = document.getElementById('metaAccountVal');
    if (accountVal && state.accountId) {
        accountVal.textContent = `${state.accountId.slice(0, 6)}...${state.accountId.slice(-4)}`;
        accountVal.title = state.accountId;
    }

    const programVal = document.getElementById('metaProgramVal');
    if (programVal && state.programId) {
        programVal.textContent = `${state.programId.slice(0, 6)}...${state.programId.slice(-4)}`;
        programVal.title = state.programId;
    }
}

function renderCircuitBreakerBanner() {
    const banner = document.getElementById('circuitBreakerBanner');
    if (!banner) return;

    if (state.circuitBreakerActive) {
        banner.style.display = 'flex';
        banner.className = 'banner banner-danger';
        banner.innerHTML = `
            <span>🚨 <strong>CIRCUIT BREAKER TRIPPED</strong>: On-chain price jump exceeded volatility threshold. State updates frozen by contract guard.</span>
            <span>Program Authority Resume Required</span>
        `;
    } else {
        banner.style.display = 'none';
    }
}

function renderBentoMetrics(entries) {
    const trackedCountEl = document.getElementById('metricTrackedCount');
    if (trackedCountEl) {
        trackedCountEl.textContent = `${entries.length} / 32`;
    }

    // Benchmark BTC price
    const btcEntry = entries.find(e => e.symbol === 'BTCUSDT') || entries[0];
    const btcPriceEl = document.getElementById('metricBtcPrice');
    const btcSubEl = document.getElementById('metricBtcSub');
    if (btcPriceEl && btcEntry) {
        btcPriceEl.textContent = `$${formatPrice(btcEntry.price)}`;
        if (btcSubEl) {
            btcSubEl.textContent = `Q64: ${btcEntry.price_q64_hex || 'N/A'}`;
        }
    }

    // Regime
    const regimeEl = document.getElementById('metricRegime');
    const regimeSubEl = document.getElementById('metricRegimeSub');
    if (regimeEl) {
        regimeEl.textContent = REGIMES[state.regimeId] || `REGIME_${state.regimeId}`;
        if (regimeSubEl) {
            regimeSubEl.textContent = `State Vector Index: ${state.regimeId}`;
        }
    }

    // Circuit Breaker State Metric
    const breakerEl = document.getElementById('metricBreaker');
    const breakerSubEl = document.getElementById('metricBreakerSub');
    if (breakerEl) {
        if (state.circuitBreakerActive) {
            breakerEl.textContent = 'TRIPPED';
            breakerEl.className = 'metric-value text-red';
            if (breakerSubEl) breakerSubEl.textContent = 'State frozen; updates blocked';
        } else {
            breakerEl.textContent = 'NORMAL';
            breakerEl.className = 'metric-value text-green';
            if (breakerSubEl) breakerSubEl.textContent = 'Guards nominal; ready';
        }
    }
}

function renderOracleTable(entries) {
    const tbody = document.getElementById('oracleTableBody');
    if (!tbody) return;

    const filtered = entries.filter(e => {
        if (!state.searchQuery) return true;
        return e.symbol.toLowerCase().includes(state.searchQuery.toLowerCase());
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 24px;">No matching assets found</td></tr>`;
        return;
    }

    // Re-render rows efficiently
    tbody.innerHTML = filtered.map(e => {
        const prevPrice = state.prevPrices[e.symbol];
        let flashClass = '';
        if (prevPrice !== undefined && prevPrice !== e.price) {
            flashClass = e.price > prevPrice ? 'flash-green' : 'flash-red';
        }

        const q64Display = state.q64Mode === 'HEX' 
            ? (e.price_q64_hex || '0x0') 
            : (e.price_q64_raw || '0');

        return `
            <tr data-symbol="${e.symbol}">
                <td>
                    <div class="symbol-badge">
                        <span class="symbol-id">#${e.symbol_id}</span>
                        <span>${e.symbol}</span>
                    </div>
                </td>
                <td class="tabular text-right ${flashClass}" id="price-${e.symbol}">
                    $${formatPrice(e.price)}
                </td>
                <td class="tabular text-right">
                    <span class="badge-bps">${e.volatility_bps} bps</span>
                </td>
                <td class="tabular text-right">
                    <span class="hex-repr" onclick="toggleQ64Mode()" title="Click to toggle Hex/Dec">${q64Display}</span>
                </td>
                <td class="tabular text-right text-muted" style="font-size: 10px;">
                    ${formatTimestamp(e.timestamp)}
                </td>
            </tr>
        `;
    }).join('');

    // Remove flash highlights after animation completes
    setTimeout(() => {
        document.querySelectorAll('.flash-green, .flash-red').forEach(el => {
            el.classList.remove('flash-green', 'flash-red');
        });
    }, 900);
}

// Feed Age Clock (ticks every 1s)
function initAgeTicker() {
    if (state.ageTimer) clearInterval(state.ageTimer);

    state.ageTimer = setInterval(() => {
        const ageEl = document.getElementById('metaFeedAge');
        if (!ageEl) return;

        if (!state.lastUpdateTS || state.lastUpdateTS === 0) {
            ageEl.textContent = 'Waiting for state...';
            return;
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const ageSec = Math.max(0, nowSec - state.lastUpdateTS);

        if (ageSec < 5) {
            ageEl.innerHTML = `<span class="text-green">${ageSec}s ago (FRESH)</span>`;
        } else if (ageSec < 60) {
            ageEl.innerHTML = `<span class="text-cyan">${ageSec}s ago</span>`;
        } else if (ageSec < 120) {
            ageEl.innerHTML = `<span class="text-amber">${ageSec}s ago (DEGRADED)</span>`;
        } else {
            ageEl.innerHTML = `<span class="text-red">${ageSec}s ago (STALE > 120s ⚠️)</span>`;
        }
    }, 1000);
}

// User Interactions
function initSearchFilter() {
    const input = document.getElementById('assetSearch');
    if (!input) return;
    input.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        if (state.rawStateJSON && state.rawStateJSON.entries) {
            renderOracleTable(state.rawStateJSON.entries);
        }
    });
}

function toggleQ64Mode() {
    state.q64Mode = state.q64Mode === 'HEX' ? 'DEC' : 'HEX';
    const btn = document.getElementById('btnToggleQ64');
    if (btn) btn.textContent = `Q64: ${state.q64Mode}`;
    if (state.rawStateJSON && state.rawStateJSON.entries) {
        renderOracleTable(state.rawStateJSON.entries);
    }
}

function renderRawJSON() {
    const el = document.getElementById('rawStateJson');
    if (!el || !state.rawStateJSON) return;
    el.textContent = JSON.stringify(state.rawStateJSON, null, 2);
}

function copyEndpoint(path) {
    const fullUrl = window.location.origin + path;
    navigator.clipboard.writeText(`curl -s ${fullUrl} | jq .`).then(() => {
        alert(`Copied curl command to clipboard:\ncurl -s ${fullUrl} | jq .`);
    }).catch(() => {
        prompt('Copy curl command:', `curl -s ${fullUrl} | jq .`);
    });
}

// Number Formatting Helpers
function formatPrice(p) {
    if (typeof p !== 'number' || isNaN(p)) return '0.00';
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (p >= 1) return p.toFixed(4);
    if (p >= 0.001) return p.toFixed(6);
    return p.toFixed(8);
}

function formatTimestamp(ts) {
    if (!ts) return 'N/A';
    const d = new Date(ts * 1000);
    return d.toTimeString().split(' ')[0];
}

// Deterministic Reference CLOB (Prototype Sandbox Simulator)
let simulatedBook = {
    bids: [
        { price: 83450.00, qty: 1.25, total: 1.25 },
        { price: 83445.50, qty: 2.10, total: 3.35 },
        { price: 83440.00, qty: 5.00, total: 8.35 },
        { price: 83435.00, qty: 12.00, total: 20.35 }
    ],
    asks: [
        { price: 83465.00, qty: 1.10, total: 1.10 },
        { price: 83470.00, qty: 3.50, total: 4.60 },
        { price: 83475.00, qty: 4.20, total: 8.80 },
        { price: 83480.00, qty: 10.00, total: 18.80 }
    ]
};
let currentSide = 'BUY';

function initOrderbook() {
    renderBook();
}

function setSide(side) {
    currentSide = side;
    document.getElementById('btnBuy').classList.toggle('active', side === 'BUY');
    document.getElementById('btnSell').classList.toggle('active', side === 'SELL');
    const submit = document.getElementById('btnSubmitOrder');
    if (submit) {
        submit.className = `submit-btn ${side === 'BUY' ? 'buy' : 'sell'}`;
        submit.textContent = `${side === 'BUY' ? 'Buy / Bid' : 'Sell / Ask'} In-Memory`;
    }
}

function renderBook() {
    const bidsEl = document.getElementById('bookBids');
    const asksEl = document.getElementById('bookAsks');
    if (!bidsEl || !asksEl) return;

    const maxBid = Math.max(...simulatedBook.bids.map(b => b.total), 1);
    const maxAsk = Math.max(...simulatedBook.asks.map(a => a.total), 1);

    bidsEl.innerHTML = simulatedBook.bids.map(b => `
        <div class="book-row">
            <div class="book-depth-bar book-depth-bid" style="width: ${(b.total / maxBid) * 100}%;"></div>
            <span class="text-green">$${b.price.toFixed(2)}</span>
            <span class="text-right">${b.qty.toFixed(2)}</span>
            <span class="text-right text-muted">${b.total.toFixed(2)}</span>
        </div>
    `).join('');

    asksEl.innerHTML = simulatedBook.asks.map(a => `
        <div class="book-row">
            <div class="book-depth-bar book-depth-ask" style="width: ${(a.total / maxAsk) * 100}%;"></div>
            <span class="text-red">$${a.price.toFixed(2)}</span>
            <span class="text-right">${a.qty.toFixed(2)}</span>
            <span class="text-right text-muted">${a.total.toFixed(2)}</span>
        </div>
    `).join('');
}

function submitSimulatedOrder() {
    const priceInput = document.getElementById('inputPrice');
    const qtyInput = document.getElementById('inputQty');
    const log = document.getElementById('tradesLog');
    if (!priceInput || !qtyInput || !log) return;

    const price = parseFloat(priceInput.value);
    const qty = parseFloat(qtyInput.value);
    if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
        alert('Please enter valid positive numbers for price and quantity.');
        return;
    }

    const timeStr = new Date().toTimeString().split(' ')[0];
    const item = document.createElement('div');
    item.className = 'trade-item';
    item.innerHTML = `
        <span><span class="text-muted">[${timeStr}]</span> ${currentSide === 'BUY' ? '<span class="text-green">BID</span>' : '<span class="text-red">ASK</span>'} @ $${price.toFixed(2)}</span>
        <span class="text-cyan">${qty.toFixed(4)} BTC</span>
    `;
    log.insertBefore(item, log.firstChild);
}

function initDeveloperHelpers() {
    // Expose global toggler for inline onclicks
    window.toggleQ64Mode = toggleQ64Mode;
    window.setSide = setSide;
    window.submitSimulatedOrder = submitSimulatedOrder;
    window.copyEndpoint = copyEndpoint;
}
