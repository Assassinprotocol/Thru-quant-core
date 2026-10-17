package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// Server coordinates REST endpoints, SSE streams, and cached oracle state
type Server struct {
	mu                       sync.RWMutex
	state                    *OracleState
	history                  map[string][]float64
	subscribers              map[chan []byte]bool
	subMu                    sync.Mutex
	startTime                time.Time
	programAddr              string
	accountAddr              string
	network                  string
	staticDir                string
	requestsTotal            atomic.Uint64
	rpcFailuresTotal         atomic.Uint64
	oracleUpdatesTotal       atomic.Uint64
	staleDiscardsTotal       atomic.Uint64
	circuitBreakerTripsTotal atomic.Uint64
}

// NewServer creates a new instance of the API server
func NewServer(programAddr, accountAddr, network, staticDir string) *Server {
	return &Server{
		history:     make(map[string][]float64),
		subscribers: make(map[chan []byte]bool),
		startTime:   time.Now(),
		programAddr: programAddr,
		accountAddr: accountAddr,
		network:     network,
		staticDir:   staticDir,
	}
}

// UpdateState replaces the current oracle state, records price history, and broadcasts to SSE clients
func (s *Server) UpdateState(newState *OracleState) {
	if newState == nil {
		return
	}

	s.mu.Lock()
	s.state = newState
	s.oracleUpdatesTotal.Add(1)
	if newState.CircuitBreakerActive {
		s.circuitBreakerTripsTotal.Add(1)
	}

	// Append to rolling price history (max 30 points per asset for charts)
	for _, entry := range newState.Entries {
		h := s.history[entry.Symbol]
		h = append(h, entry.Price)
		if len(h) > 30 {
			h = h[len(h)-30:]
		}
		s.history[entry.Symbol] = h
	}
	s.mu.Unlock()

	// Broadcast update to all connected SSE clients
	payload, err := json.Marshal(newState)
	if err == nil {
		s.subMu.Lock()
		for ch := range s.subscribers {
			select {
			case ch <- payload:
			default:
				// Avoid blocking if subscriber buffer is full
			}
		}
		s.subMu.Unlock()
	}
}

const MaxSSEClients = 256

// RegisterRoutes registers all REST and SSE endpoints with the given ServeMux
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", s.withCORS(s.handleHealth))
	mux.HandleFunc("/ready", s.withCORS(s.handleReady))
	mux.HandleFunc("/v1/status", s.withCORS(s.handleStatus))
	mux.HandleFunc("/v1/oracle/latest", s.withCORS(s.handleOracleLatest))
	mux.HandleFunc("/v1/oracle/history", s.withCORS(s.handleOracleHistory))
	mux.HandleFunc("/v1/stream", s.withCORS(s.handleStream))
	mux.HandleFunc("/metrics", s.handleMetrics)

	if s.staticDir != "" {
		fs := http.FileServer(http.Dir(s.staticDir))
		mux.Handle("/", fs)
	}
}

// RecordRPCFailure records a failed RPC transmission
func (s *Server) RecordRPCFailure() {
	s.rpcFailuresTotal.Add(1)
}

// RecordStaleDiscard records a discarded stale quote batch
func (s *Server) RecordStaleDiscard() {
	s.staleDiscardsTotal.Add(1)
}

func (s *Server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.requestsTotal.Add(1)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	feedAge := uint32(0)
	breaker := false
	source := "uninitialized"
	slot := uint64(0)
	assets := 0

	if s.state != nil {
		nowSec := uint32(time.Now().Unix())
		if nowSec > s.state.LastUpdateTS && s.state.LastUpdateTS > 0 {
			feedAge = nowSec - s.state.LastUpdateTS
		}
		breaker = s.state.CircuitBreakerActive
		source = s.state.SourceMode
		slot = s.state.Slot
		assets = len(s.state.Entries)
	}
	s.mu.RUnlock()

	status := "healthy"
	if s.state == nil {
		status = "uninitialized"
	} else if breaker {
		status = "circuit_breaker_active"
	} else if feedAge > 120 {
		status = "stale"
	}

	resp := HealthResponse{
		Status:               status,
		FeedAgeSec:           feedAge,
		CircuitBreakerActive: breaker,
		Source:               source,
		Slot:                 slot,
		TrackedAssets:        assets,
		UptimeSec:            int64(time.Since(s.startTime).Seconds()),
	}

	w.Header().Set("Content-Type", "application/json")
	if status == "healthy" {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	feedAge := uint32(0)
	breaker := false
	source := "uninitialized"
	slot := uint64(0)
	assets := 0

	if s.state != nil {
		nowSec := uint32(time.Now().Unix())
		if nowSec > s.state.LastUpdateTS && s.state.LastUpdateTS > 0 {
			feedAge = nowSec - s.state.LastUpdateTS
		}
		breaker = s.state.CircuitBreakerActive
		source = s.state.SourceMode
		slot = s.state.Slot
		assets = len(s.state.Entries)
	}
	s.mu.RUnlock()

	ready := true
	status := "ready"
	if s.state == nil {
		ready = false
		status = "uninitialized"
	} else if breaker {
		ready = false
		status = "circuit_breaker_active"
	} else if feedAge > 120 {
		ready = false
		status = "stale"
	} else if source == "LOCAL_SNAPSHOT_FAILOVER" || source == "LOCAL_SNAPSHOT_FALLBACK_DEV" {
		ready = false
		status = "unverified_fallback_source"
	}

	resp := ReadyResponse{
		Status:               status,
		Ready:                ready,
		FeedAgeSec:           feedAge,
		CircuitBreakerActive: breaker,
		Source:               source,
		Slot:                 slot,
		TrackedAssets:        assets,
	}

	w.Header().Set("Content-Type", "application/json")
	if ready {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	feedAge := uint32(0)
	breaker := false
	regime := "NEUTRAL_SIDEWAYS"
	source := "uninitialized"
	slot := uint64(0)
	quoteCount := 0
	lastUpdate := uint32(0)

	if s.state != nil {
		nowSec := uint32(time.Now().Unix())
		if nowSec > s.state.LastUpdateTS && s.state.LastUpdateTS > 0 {
			feedAge = nowSec - s.state.LastUpdateTS
		}
		breaker = s.state.CircuitBreakerActive
		regime = s.state.RegimeName
		source = s.state.SourceMode
		slot = s.state.Slot
		quoteCount = len(s.state.Entries)
		lastUpdate = s.state.LastUpdateTS
	}

	resp := StatusResponse{
		Network:              s.network,
		ProgramAddress:       s.programAddr,
		AccountAddress:       s.accountAddr,
		Slot:                 slot,
		CircuitBreakerActive: breaker,
		Regime:               regime,
		FeedAgeSec:           feedAge,
		QuoteCount:           quoteCount,
		SourceMode:           source,
		LastUpdateTS:         lastUpdate,
		UptimeSec:            int64(time.Since(s.startTime).Seconds()),
		Metrics: OperationalMetrics{
			RequestsTotal:            s.requestsTotal.Load(),
			RPCFailuresTotal:         s.rpcFailuresTotal.Load(),
			OracleUpdatesTotal:       s.oracleUpdatesTotal.Load(),
			StaleDiscardsTotal:       s.staleDiscardsTotal.Load(),
			CircuitBreakerTripsTotal: s.circuitBreakerTripsTotal.Load(),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleOracleLatest(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.state == nil {
		http.Error(w, `{"error":"oracle state not yet loaded"}`, http.StatusServiceUnavailable)
		return
	}

	// Update feed age dynamically
	nowSec := uint32(time.Now().Unix())
	if nowSec > s.state.LastUpdateTS && s.state.LastUpdateTS > 0 {
		s.state.FeedAgeSec = nowSec - s.state.LastUpdateTS
	}

	for i := range s.state.Entries {
		if nowSec > s.state.Entries[i].Timestamp && s.state.Entries[i].Timestamp > 0 {
			s.state.Entries[i].AgeSec = nowSec - s.state.Entries[i].Timestamp
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.state)
}

func (s *Server) handleOracleHistory(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.history)
}

func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	rc := http.NewResponseController(w)
	// Clear the server-wide WriteTimeout so persistent SSE streaming connections are not killed at 15s
	_ = rc.SetWriteDeadline(time.Time{})

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	subChan := make(chan []byte, 16)

	s.subMu.Lock()
	if len(s.subscribers) >= MaxSSEClients {
		s.subMu.Unlock()
		http.Error(w, `{"error":"maximum SSE subscriber limit reached (256)"}`, http.StatusServiceUnavailable)
		return
	}
	s.subscribers[subChan] = true
	s.subMu.Unlock()

	defer func() {
		s.subMu.Lock()
		delete(s.subscribers, subChan)
		close(subChan)
		s.subMu.Unlock()
	}()

	// Send initial state immediately
	s.mu.RLock()
	if s.state != nil {
		initialBytes, err := json.Marshal(s.state)
		if err == nil {
			_ = rc.SetWriteDeadline(time.Now().Add(30 * time.Second))
			fmt.Fprintf(w, "event: oracle_state\ndata: %s\n\n", initialBytes)
			flusher.Flush()
		}
	}
	s.mu.RUnlock()

	keepaliveTicker := time.NewTicker(10 * time.Second)
	defer keepaliveTicker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepaliveTicker.C:
			_ = rc.SetWriteDeadline(time.Now().Add(30 * time.Second))
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		case data := <-subChan:
			_ = rc.SetWriteDeadline(time.Now().Add(30 * time.Second))
			fmt.Fprintf(w, "event: oracle_state\ndata: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	feedAge := uint32(0)
	breakerActive := 0
	if s.state != nil {
		nowSec := uint32(time.Now().Unix())
		if nowSec > s.state.LastUpdateTS && s.state.LastUpdateTS > 0 {
			feedAge = nowSec - s.state.LastUpdateTS
		}
		if s.state.CircuitBreakerActive {
			breakerActive = 1
		}
	}
	s.mu.RUnlock()

	s.subMu.Lock()
	activeClients := len(s.subscribers)
	s.subMu.Unlock()

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	fmt.Fprintf(w, "# HELP api_requests_total Total HTTP requests handled\n")
	fmt.Fprintf(w, "# TYPE api_requests_total counter\n")
	fmt.Fprintf(w, "api_requests_total %d\n\n", s.requestsTotal.Load())

	fmt.Fprintf(w, "# HELP api_rpc_failures_total Total failed RPC calls to the Thru node\n")
	fmt.Fprintf(w, "# TYPE api_rpc_failures_total counter\n")
	fmt.Fprintf(w, "api_rpc_failures_total %d\n\n", s.rpcFailuresTotal.Load())

	fmt.Fprintf(w, "# HELP api_oracle_updates_total Total on-chain oracle updates received\n")
	fmt.Fprintf(w, "# TYPE api_oracle_updates_total counter\n")
	fmt.Fprintf(w, "api_oracle_updates_total %d\n\n", s.oracleUpdatesTotal.Load())

	fmt.Fprintf(w, "# HELP api_circuit_breaker_trips_total Total circuit breaker trips observed\n")
	fmt.Fprintf(w, "# TYPE api_circuit_breaker_trips_total counter\n")
	fmt.Fprintf(w, "api_circuit_breaker_trips_total %d\n\n", s.circuitBreakerTripsTotal.Load())

	fmt.Fprintf(w, "# HELP api_stream_clients_active Number of active SSE streaming clients\n")
	fmt.Fprintf(w, "# TYPE api_stream_clients_active gauge\n")
	fmt.Fprintf(w, "api_stream_clients_active %d\n\n", activeClients)

	fmt.Fprintf(w, "# HELP api_feed_age_seconds Current age of the oracle state in seconds\n")
	fmt.Fprintf(w, "# TYPE api_feed_age_seconds gauge\n")
	fmt.Fprintf(w, "api_feed_age_seconds %d\n\n", feedAge)

	fmt.Fprintf(w, "# HELP api_circuit_breaker_active Whether circuit breaker is tripped (1) or normal (0)\n")
	fmt.Fprintf(w, "# TYPE api_circuit_breaker_active gauge\n")
	fmt.Fprintf(w, "api_circuit_breaker_active %d\n", breakerActive)
}
