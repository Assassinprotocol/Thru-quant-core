package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func setupTestServer() *Server {
	srv := NewServer(
		"taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR",
		"taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN",
		"Alphanet",
		"",
	)
	state, _ := DecodeOracleAccountBase64(realAlphanetBase64)
	state.SourceMode = "ON_CHAIN_TEST"
	state.Slot = 7743340
	state.LastUpdateTS = uint32(time.Now().Unix()) // Set fresh timestamp for healthy test
	srv.UpdateState(state)
	return srv
}

func TestHandleHealth(t *testing.T) {
	srv := setupTestServer()
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp HealthResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed decoding health response: %v", err)
	}

	if resp.Status != "healthy" {
		t.Errorf("expected status healthy, got %s", resp.Status)
	}
	if resp.TrackedAssets != 28 {
		t.Errorf("expected 28 assets, got %d", resp.TrackedAssets)
	}
	if resp.Slot != 7743340 {
		t.Errorf("expected slot 7743340, got %d", resp.Slot)
	}
}

func TestHandleHealth_Stale(t *testing.T) {
	srv := setupTestServer()
	srv.mu.Lock()
	srv.state.LastUpdateTS = uint32(time.Now().Unix()) - 300 // 5 minutes old
	srv.mu.Unlock()

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 for stale feed, got %d", w.Code)
	}

	var resp HealthResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Status != "stale" {
		t.Errorf("expected status stale, got %s", resp.Status)
	}
}

func TestHandleStatus(t *testing.T) {
	srv := setupTestServer()
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/v1/status", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var resp StatusResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed decoding status response: %v", err)
	}

	if resp.Network != "Alphanet" {
		t.Errorf("expected network Alphanet, got %s", resp.Network)
	}
	if resp.QuoteCount != 28 {
		t.Errorf("expected quote count 28, got %d", resp.QuoteCount)
	}
	if resp.Metrics.RequestsTotal == 0 {
		t.Errorf("expected requests_total > 0, got %d", resp.Metrics.RequestsTotal)
	}
}

func TestHandleReady(t *testing.T) {
	srv := setupTestServer()
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	// Case 1: Fresh state -> 200 OK, ready == true
	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 for ready probe, got %d", w.Code)
	}

	var resp ReadyResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed decoding ready response: %v", err)
	}
	if !resp.Ready || resp.Status != "ready" {
		t.Errorf("expected ready true, got ready=%v status=%s", resp.Ready, resp.Status)
	}

	// Case 2: Stale state -> 503 Service Unavailable, ready == false
	srv.mu.Lock()
	srv.state.LastUpdateTS = uint32(time.Now().Unix()) - 300
	srv.mu.Unlock()

	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 for stale ready probe, got %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Ready || resp.Status != "stale" {
		t.Errorf("expected ready false with stale status, got ready=%v status=%s", resp.Ready, resp.Status)
	}

	// Case 3: Circuit breaker tripped -> 503 Service Unavailable, ready == false
	srv.mu.Lock()
	srv.state.LastUpdateTS = uint32(time.Now().Unix())
	srv.state.CircuitBreakerActive = true
	srv.mu.Unlock()

	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 for tripped breaker, got %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Ready || resp.Status != "circuit_breaker_active" {
		t.Errorf("expected ready false with circuit_breaker_active, got ready=%v status=%s", resp.Ready, resp.Status)
	}
}

func TestHandleOracleLatest(t *testing.T) {
	srv := setupTestServer()
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/v1/oracle/latest", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var state OracleState
	if err := json.Unmarshal(w.Body.Bytes(), &state); err != nil {
		t.Fatalf("failed decoding oracle state: %v", err)
	}

	if len(state.Entries) != 28 {
		t.Errorf("expected 28 entries, got %d", len(state.Entries))
	}
}

func TestHandleMetrics(t *testing.T) {
	srv := setupTestServer()
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 for /metrics, got %d", w.Code)
	}

	body := w.Body.String()
	expectedMetrics := []string{
		"api_requests_total",
		"api_rpc_failures_total",
		"api_oracle_updates_total",
		"api_stream_clients_active",
		"api_circuit_breaker_active",
	}

	for _, m := range expectedMetrics {
		if !strings.Contains(body, m) {
			t.Errorf("expected metric %s in /metrics output", m)
		}
	}
}

func TestHandleReady_UnverifiedSource(t *testing.T) {
	srv := setupTestServer()
	srv.mu.Lock()
	srv.state.SourceMode = "LOCAL_SNAPSHOT_FAILOVER"
	srv.mu.Unlock()

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/ready", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 for unverified fallback source, got %d", w.Code)
	}

	var resp ReadyResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Ready || resp.Status != "unverified_fallback_source" {
		t.Errorf("expected ready false with unverified_fallback_source, got ready=%v status=%s", resp.Ready, resp.Status)
	}
}

func TestSSEStreaming(t *testing.T) {
	srv := setupTestServer()
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req := httptest.NewRequest("GET", "/v1/stream", nil).WithContext(ctx)
	w := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		defer close(done)
		mux.ServeHTTP(w, req)
	}()

	// Allow client connection to register
	time.Sleep(50 * time.Millisecond)

	srv.subMu.Lock()
	subs := len(srv.subscribers)
	srv.subMu.Unlock()
	if subs != 1 {
		t.Fatalf("expected 1 active subscriber, got %d", subs)
	}

	// Trigger a state update broadcast
	freshState := *srv.state
	freshState.Slot = 7743345
	srv.UpdateState(&freshState)

	time.Sleep(50 * time.Millisecond)
	cancel()
	<-done

	output := w.Body.String()
	if !strings.Contains(output, "event: oracle_state") {
		t.Errorf("expected event: oracle_state in stream output")
	}
}
