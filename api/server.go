package api

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// visitor tracks token bucket rate limiting state for a client IP
type visitor struct {
	tokens   float64
	lastSeen time.Time
}

// rateLimiter enforces token-bucket rate limits per client IP
type rateLimiter struct {
	mu          sync.Mutex
	visitors    map[string]*visitor
	capacity    float64
	rate        float64
	maxVisitors int
	stopCleanup chan struct{}
}

func newRateLimiter(capacity, rate float64, maxVisitors ...int) *rateLimiter {
	max := 10000
	if len(maxVisitors) > 0 && maxVisitors[0] > 0 {
		max = maxVisitors[0]
	}
	rl := &rateLimiter{
		visitors:    make(map[string]*visitor),
		capacity:    capacity,
		rate:        rate,
		maxVisitors: max,
		stopCleanup: make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *rateLimiter) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			rl.cleanup(3 * time.Minute)
		case <-rl.stopCleanup:
			return
		}
	}
}

func (rl *rateLimiter) cleanup(maxAge time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for k, val := range rl.visitors {
		if now.Sub(val.lastSeen) > maxAge {
			delete(rl.visitors, k)
		}
	}
}

func (rl *rateLimiter) Close() {
	select {
	case <-rl.stopCleanup:
	default:
		close(rl.stopCleanup)
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	v, exists := rl.visitors[ip]
	if !exists {
		if len(rl.visitors) >= rl.maxVisitors {
			for k, val := range rl.visitors {
				if now.Sub(val.lastSeen) > time.Minute {
					delete(rl.visitors, k)
				}
			}
			if len(rl.visitors) >= rl.maxVisitors {
				return false
			}
		}
		rl.visitors[ip] = &visitor{
			tokens:   rl.capacity - 1.0,
			lastSeen: now,
		}
		return true
	}

	elapsed := now.Sub(v.lastSeen).Seconds()
	v.lastSeen = now
	v.tokens += elapsed * rl.rate
	if v.tokens > rl.capacity {
		v.tokens = rl.capacity
	}

	if v.tokens >= 1.0 {
		v.tokens -= 1.0
		return true
	}

	return false
}

// Server coordinates REST endpoints, SSE streams, and cached oracle state
type Server struct {
	mu                       sync.RWMutex
	state                    *OracleState
	history                  map[string][]float64
	subscribers              map[chan []byte]string
	subscribersByIP          map[string]int
	subMu                    sync.Mutex
	startTime                time.Time
	programAddr              string
	accountAddr              string
	network                  string
	staticDir                string
	limiter                  *rateLimiter
	trustedProxies           []*net.IPNet
	metricsToken             string
	corsOrigins              []string
	maxSSEGlobal             int
	maxSSEPerIP              int
	requestsTotal            atomic.Uint64
	rpcFailuresTotal         atomic.Uint64
	oracleUpdatesTotal       atomic.Uint64
	staleDiscardsTotal       atomic.Uint64
	circuitBreakerTripsTotal atomic.Uint64
}

// NewServer creates a new instance of the API server
func NewServer(programAddr, accountAddr, network, staticDir string) *Server {
	return &Server{
		history:         make(map[string][]float64),
		subscribers:     make(map[chan []byte]string),
		subscribersByIP: make(map[string]int),
		startTime:       time.Now(),
		programAddr:     programAddr,
		accountAddr:     accountAddr,
		network:         network,
		staticDir:       staticDir,
		limiter:         newRateLimiter(100.0, 50.0, 10000),
		corsOrigins:     []string{"*"},
		maxSSEGlobal:    256,
		maxSSEPerIP:     4,
	}
}

// Close gracefully stops background workers and rate limiter timers
func (s *Server) Close() {
	if s.limiter != nil {
		s.limiter.Close()
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

	for _, entry := range newState.Entries {
		h := s.history[entry.Symbol]
		h = append(h, entry.Price)
		if len(h) > 30 {
			h = h[len(h)-30:]
		}
		s.history[entry.Symbol] = h
	}
	s.mu.Unlock()

	payload, err := json.Marshal(newState)
	if err == nil {
		s.subMu.Lock()
		for ch := range s.subscribers {
			select {
			case ch <- payload:
			default:
			}
		}
		s.subMu.Unlock()
	}
}

const MaxSSEClients = 256

// SetTrustedProxies configures trusted upstream proxy CIDRs for X-Forwarded-For parsing
func (s *Server) SetTrustedProxies(cidrs []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var parsed []*net.IPNet
	for _, raw := range cidrs {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		if !strings.Contains(raw, "/") {
			if ip := net.ParseIP(raw); ip != nil {
				if ip.To4() != nil {
					raw += "/32"
				} else {
					raw += "/128"
				}
			}
		}
		_, ipNet, err := net.ParseCIDR(raw)
		if err != nil {
			return fmt.Errorf("invalid trusted proxy CIDR %q: %w", raw, err)
		}
		parsed = append(parsed, ipNet)
	}
	s.trustedProxies = parsed
	return nil
}

// SetMetricsToken sets the required bearer token for /metrics when accessed externally
func (s *Server) SetMetricsToken(token string) {
	s.mu.Lock()
	s.metricsToken = strings.TrimSpace(token)
	s.mu.Unlock()
}

// SetCORSOrigins sets allowed CORS origins
func (s *Server) SetCORSOrigins(origins []string) {
	s.mu.Lock()
	s.corsOrigins = origins
	s.mu.Unlock()
}

// SetSSELimits configures global and per-IP concurrent SSE stream caps
func (s *Server) SetSSELimits(global, perIP int) {
	s.subMu.Lock()
	if global > 0 {
		s.maxSSEGlobal = global
	}
	if perIP > 0 {
		s.maxSSEPerIP = perIP
	}
	s.subMu.Unlock()
}

func (s *Server) clientIP(r *http.Request) string {
	remoteHost, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteHost = r.RemoteAddr
	}

	remoteIP := net.ParseIP(remoteHost)
	if remoteIP == nil {
		return remoteHost
	}

	s.mu.RLock()
	trusted := false
	for _, cidr := range s.trustedProxies {
		if cidr.Contains(remoteIP) {
			trusted = true
			break
		}
	}
	s.mu.RUnlock()

	if trusted {
		xff := r.Header.Get("X-Forwarded-For")
		if xff != "" {
			parts := strings.Split(xff, ",")
			clientCandidate := strings.TrimSpace(parts[0])
			if parsed := net.ParseIP(clientCandidate); parsed != nil {
				return parsed.String()
			}
		}
	}

	return remoteIP.String()
}

func (s *Server) withSecurityHeaders(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next(w, r)
	}
}

// RegisterRoutes registers all REST and SSE endpoints with the given ServeMux
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/health", s.withSecurityHeaders(s.withCORS(s.withRateLimit(s.handleHealth))))
	mux.HandleFunc("/ready", s.withSecurityHeaders(s.withCORS(s.withRateLimit(s.handleReady))))
	mux.HandleFunc("/v1/status", s.withSecurityHeaders(s.withCORS(s.withRateLimit(s.handleStatus))))
	mux.HandleFunc("/v1/oracle/latest", s.withSecurityHeaders(s.withCORS(s.withRateLimit(s.handleOracleLatest))))
	mux.HandleFunc("/v1/oracle/history", s.withSecurityHeaders(s.withCORS(s.withRateLimit(s.handleOracleHistory))))
	mux.HandleFunc("/v1/stream", s.withSecurityHeaders(s.withCORS(s.withRateLimit(s.handleStream))))
	mux.HandleFunc("/metrics", s.withSecurityHeaders(s.withRateLimit(s.handleMetrics)))

	if s.staticDir != "" {
		fs := http.FileServer(http.Dir(s.staticDir))
		mux.Handle("/", s.withSecurityHeaders(fs.ServeHTTP))
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

func (s *Server) withRateLimit(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := s.clientIP(r)

		if !s.limiter.allow(ip) {
			w.Header().Set("Retry-After", "1")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"rate limit exceeded"}`))
			return
		}

		next(w, r)
	}
}

func (s *Server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.requestsTotal.Add(1)

		origin := r.Header.Get("Origin")
		allowedOrigin := ""

		s.mu.RLock()
		origins := s.corsOrigins
		s.mu.RUnlock()

		for _, o := range origins {
			if o == "*" || o == origin {
				allowedOrigin = o
				break
			}
		}

		if allowedOrigin != "" {
			if allowedOrigin == "*" {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
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
		IntegrityWarnings:    computeIntegrityWarnings(s.state),
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

func computeIntegrityWarnings(state *OracleState) []string {
	if state == nil {
		return nil
	}

	var warnings []string
	if state.FeedAgeSec > 120 {
		warnings = append(warnings, "FEED_STALE_EXCEEDED_FAIL_CLOSED_BOUNDARY")
	}
	if state.CircuitBreakerActive {
		warnings = append(warnings, "CIRCUIT_BREAKER_ACTIVE_ON_CHAIN")
	}

	for _, entry := range state.Entries {
		if entry.AgeSec > 120 {
			warnings = append(warnings, fmt.Sprintf("ENTRY_STALE: %s", entry.Symbol))
		}
		if entry.VolatilityBps == 0xFFFFFFFF {
			warnings = append(warnings, fmt.Sprintf("VOLATILITY_UNCOMPUTED: %s", entry.Symbol))
		}
	}

	return warnings
}

func (s *Server) handleOracleLatest(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.state == nil {
		http.Error(w, `{"error":"oracle state not yet loaded"}`, http.StatusServiceUnavailable)
		return
	}

	nowSec := uint32(time.Now().Unix())
	if nowSec > s.state.LastUpdateTS && s.state.LastUpdateTS > 0 {
		s.state.FeedAgeSec = nowSec - s.state.LastUpdateTS
	}

	for i := range s.state.Entries {
		if nowSec > s.state.Entries[i].Timestamp && s.state.Entries[i].Timestamp > 0 {
			s.state.Entries[i].AgeSec = nowSec - s.state.Entries[i].Timestamp
		}
	}

	s.state.IntegrityWarnings = computeIntegrityWarnings(s.state)

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

	ip := s.clientIP(r)

	s.subMu.Lock()
	if len(s.subscribers) >= s.maxSSEGlobal {
		s.subMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"error":"maximum global SSE subscriber limit reached"}`))
		return
	}
	if s.subscribersByIP[ip] >= s.maxSSEPerIP {
		s.subMu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"error":"maximum per-IP SSE subscriber limit reached"}`))
		return
	}

	subChan := make(chan []byte, 16)
	s.subscribers[subChan] = ip
	s.subscribersByIP[ip]++
	s.subMu.Unlock()

	defer func() {
		s.subMu.Lock()
		delete(s.subscribers, subChan)
		s.subscribersByIP[ip]--
		if s.subscribersByIP[ip] <= 0 {
			delete(s.subscribersByIP, ip)
		}
		close(subChan)
		s.subMu.Unlock()
	}()

	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{})

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

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
	remoteHost, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteHost = r.RemoteAddr
	}
	remoteIP := net.ParseIP(remoteHost)
	isLoopback := remoteIP != nil && remoteIP.IsLoopback()

	s.mu.RLock()
	token := s.metricsToken
	s.mu.RUnlock()

	authorized := isLoopback
	if !authorized && token != "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			provided := strings.TrimPrefix(authHeader, "Bearer ")
			if subtle.ConstantTimeCompare([]byte(provided), []byte(token)) == 1 {
				authorized = true
			}
		}
	}

	if !authorized {
		w.Header().Set("WWW-Authenticate", `Bearer realm="metrics"`)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"unauthorized access to operational metrics"}`))
		return
	}

	s.mu.RLock()
	feedAge := uint32(0)
	breakerActive := 0
	slot := uint64(0)
	trackedAssets := 0
	if s.state != nil {
		nowSec := uint32(time.Now().Unix())
		if nowSec > s.state.LastUpdateTS && s.state.LastUpdateTS > 0 {
			feedAge = nowSec - s.state.LastUpdateTS
		}
		if s.state.CircuitBreakerActive {
			breakerActive = 1
		}
		slot = s.state.Slot
		trackedAssets = len(s.state.Entries)
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

	fmt.Fprintf(w, "# HELP api_feed_age_slots Feed age measured in slot units (average 1 slot/sec)\n")
	fmt.Fprintf(w, "# TYPE api_feed_age_slots gauge\n")
	fmt.Fprintf(w, "api_feed_age_slots %d\n\n", feedAge)

	fmt.Fprintf(w, "# HELP api_oracle_slot On-chain slot recorded in current oracle state\n")
	fmt.Fprintf(w, "# TYPE api_oracle_slot gauge\n")
	fmt.Fprintf(w, "api_oracle_slot %d\n\n", slot)

	fmt.Fprintf(w, "# HELP api_tracked_assets Number of actively quoted assets\n")
	fmt.Fprintf(w, "# TYPE api_tracked_assets gauge\n")
	fmt.Fprintf(w, "api_tracked_assets %d\n\n", trackedAssets)

	fmt.Fprintf(w, "# HELP api_circuit_breaker_active Whether circuit breaker is tripped (1) or normal (0)\n")
	fmt.Fprintf(w, "# TYPE api_circuit_breaker_active gauge\n")
	fmt.Fprintf(w, "api_circuit_breaker_active %d\n", breakerActive)
}
