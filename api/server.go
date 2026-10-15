package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Server coordinates REST endpoints, SSE streams, and cached oracle state
type Server struct {
	mu           sync.RWMutex
	state        *OracleState
	history      map[string][]float64
	subscribers  map[chan []byte]bool
	subMu        sync.Mutex
	startTime    time.Time
	programAddr  string
	accountAddr  string
	network      string
	staticDir    string
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

// RegisterRoutes registers all REST and SSE endpoints with the given ServeMux
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", s.withCORS(s.handleHealth))
	mux.HandleFunc("/v1/status", s.withCORS(s.handleStatus))
	mux.HandleFunc("/v1/oracle/latest", s.withCORS(s.handleOracleLatest))
	mux.HandleFunc("/v1/oracle/history", s.withCORS(s.handleOracleHistory))
	mux.HandleFunc("/v1/stream", s.withCORS(s.handleStream))

	if s.staticDir != "" {
		fs := http.FileServer(http.Dir(s.staticDir))
		mux.Handle("/", fs)
	}
}

func (s *Server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
	defer s.mu.RUnlock()

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

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	subChan := make(chan []byte, 16)

	s.subMu.Lock()
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
			fmt.Fprintf(w, "event: oracle_state\ndata: %s\n\n", initialBytes)
			flusher.Flush()
		}
	}
	s.mu.RUnlock()

	keepaliveTicker := time.NewTicker(15 * time.Second)
	defer keepaliveTicker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepaliveTicker.C:
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		case data := <-subChan:
			fmt.Fprintf(w, "event: oracle_state\ndata: %s\n\n", data)
			flusher.Flush()
		}
	}
}
