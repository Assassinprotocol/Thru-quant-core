package api

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAttack_XFFSpoofIgnoredFromUntrustedRemote(t *testing.T) {
	srv := setupTestServer()
	srv.limiter = newRateLimiter(3.0, 0.1, 100)

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	untrustedRemote := "198.51.100.10:43210"

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/health", nil)
		req.RemoteAddr = untrustedRemote
		req.Header.Set("X-Forwarded-For", "10.0.0."+string(rune('1'+i)))
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}

	reqSpoof := httptest.NewRequest("GET", "/health", nil)
	reqSpoof.RemoteAddr = untrustedRemote
	reqSpoof.Header.Set("X-Forwarded-For", "10.0.0.99")
	wSpoof := httptest.NewRecorder()
	mux.ServeHTTP(wSpoof, reqSpoof)

	if wSpoof.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 for spoofed XFF from untrusted remote, got %d", wSpoof.Code)
	}
}

func TestSecurity_XFFTrustedProxyEnforced(t *testing.T) {
	srv := setupTestServer()
	srv.limiter = newRateLimiter(2.0, 0.1, 100)
	if err := srv.SetTrustedProxies([]string{"10.0.0.0/8"}); err != nil {
		t.Fatalf("failed setting trusted proxy: %v", err)
	}

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	proxyAddr := "10.0.0.5:12345"

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("GET", "/health", nil)
		req.RemoteAddr = proxyAddr
		req.Header.Set("X-Forwarded-For", "203.0.113.1, 10.0.0.5")
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("client A request %d: expected 200, got %d", i+1, w.Code)
		}
	}

	reqA3 := httptest.NewRequest("GET", "/health", nil)
	reqA3.RemoteAddr = proxyAddr
	reqA3.Header.Set("X-Forwarded-For", "203.0.113.1, 10.0.0.5")
	wA3 := httptest.NewRecorder()
	mux.ServeHTTP(wA3, reqA3)
	if wA3.Code != http.StatusTooManyRequests {
		t.Fatalf("client A 3rd request: expected 429, got %d", wA3.Code)
	}

	reqB := httptest.NewRequest("GET", "/health", nil)
	reqB.RemoteAddr = proxyAddr
	reqB.Header.Set("X-Forwarded-For", "203.0.113.2, 10.0.0.5")
	wB := httptest.NewRecorder()
	mux.ServeHTTP(wB, reqB)
	if wB.Code != http.StatusOK {
		t.Fatalf("client B request: expected 200, got %d", wB.Code)
	}
}

func TestAttack_VisitorTableBounded(t *testing.T) {
	limiter := newRateLimiter(5.0, 1.0, 3)
	defer limiter.Close()

	if !limiter.allow("1.1.1.1") || !limiter.allow("1.1.1.2") || !limiter.allow("1.1.1.3") {
		t.Fatalf("expected initial 3 IPs allowed")
	}

	if limiter.allow("1.1.1.4") {
		t.Fatalf("expected IP 4 rejected when visitor table is saturated")
	}
}

func TestAttack_MetricsAuthEnforcement(t *testing.T) {
	srv := setupTestServer()
	srv.SetMetricsToken("guard-token-test-xyz")

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	externalAddr := "198.51.100.25:54321"

	reqNoAuth := httptest.NewRequest("GET", "/metrics", nil)
	reqNoAuth.RemoteAddr = externalAddr
	wNoAuth := httptest.NewRecorder()
	mux.ServeHTTP(wNoAuth, reqNoAuth)
	if wNoAuth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without auth, got %d", wNoAuth.Code)
	}
	if !strings.Contains(wNoAuth.Header().Get("WWW-Authenticate"), "Bearer") {
		t.Errorf("missing WWW-Authenticate header")
	}

	reqWrongAuth := httptest.NewRequest("GET", "/metrics", nil)
	reqWrongAuth.RemoteAddr = externalAddr
	reqWrongAuth.Header.Set("Authorization", "Bearer invalid-token")
	wWrongAuth := httptest.NewRecorder()
	mux.ServeHTTP(wWrongAuth, reqWrongAuth)
	if wWrongAuth.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for invalid token, got %d", wWrongAuth.Code)
	}

	reqValidAuth := httptest.NewRequest("GET", "/metrics", nil)
	reqValidAuth.RemoteAddr = externalAddr
	reqValidAuth.Header.Set("Authorization", "Bearer guard-token-test-xyz")
	wValidAuth := httptest.NewRecorder()
	mux.ServeHTTP(wValidAuth, reqValidAuth)
	if wValidAuth.Code != http.StatusOK {
		t.Fatalf("expected 200 with valid token, got %d", wValidAuth.Code)
	}

	reqLoopbackIPv4 := httptest.NewRequest("GET", "/metrics", nil)
	reqLoopbackIPv4.RemoteAddr = "127.0.0.1:45678"
	wLoopbackIPv4 := httptest.NewRecorder()
	mux.ServeHTTP(wLoopbackIPv4, reqLoopbackIPv4)
	if wLoopbackIPv4.Code != http.StatusOK {
		t.Fatalf("expected 200 for 127.0.0.1 without token, got %d", wLoopbackIPv4.Code)
	}

	reqLoopbackIPv6 := httptest.NewRequest("GET", "/metrics", nil)
	reqLoopbackIPv6.RemoteAddr = "[::1]:45678"
	wLoopbackIPv6 := httptest.NewRecorder()
	mux.ServeHTTP(wLoopbackIPv6, reqLoopbackIPv6)
	if wLoopbackIPv6.Code != http.StatusOK {
		t.Fatalf("expected 200 for [::1] without token, got %d", wLoopbackIPv6.Code)
	}
}

func TestAttack_SSEFloodPerIPCapped(t *testing.T) {
	srv := setupTestServer()
	srv.SetSSELimits(10, 2)

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	clientIP := "198.51.100.30:1111"

	ctx1, cancel1 := context.WithCancel(context.Background())
	defer cancel1()
	req1 := httptest.NewRequest("GET", "/v1/stream", nil).WithContext(ctx1)
	req1.RemoteAddr = clientIP
	w1 := httptest.NewRecorder()
	go mux.ServeHTTP(w1, req1)

	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	req2 := httptest.NewRequest("GET", "/v1/stream", nil).WithContext(ctx2)
	req2.RemoteAddr = clientIP
	w2 := httptest.NewRecorder()
	go mux.ServeHTTP(w2, req2)

	time.Sleep(50 * time.Millisecond)

	req3 := httptest.NewRequest("GET", "/v1/stream", nil)
	req3.RemoteAddr = clientIP
	w3 := httptest.NewRecorder()
	mux.ServeHTTP(w3, req3)

	if w3.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 for exceeding per-IP SSE cap, got %d", w3.Code)
	}

	ctxOther, cancelOther := context.WithCancel(context.Background())
	defer cancelOther()
	reqOther := httptest.NewRequest("GET", "/v1/stream", nil).WithContext(ctxOther)
	reqOther.RemoteAddr = "198.51.100.31:2222"
	wOther := httptest.NewRecorder()
	go mux.ServeHTTP(wOther, reqOther)

	time.Sleep(50 * time.Millisecond)
	srv.subMu.Lock()
	activeCount := len(srv.subscribers)
	srv.subMu.Unlock()
	if activeCount != 3 {
		t.Fatalf("expected 3 total active subscribers, got %d", activeCount)
	}
}

func TestAttack_SSEGlobalExhaustionCapped(t *testing.T) {
	srv := setupTestServer()
	srv.SetSSELimits(2, 2)

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	ctx1, cancel1 := context.WithCancel(context.Background())
	defer cancel1()
	req1 := httptest.NewRequest("GET", "/v1/stream", nil).WithContext(ctx1)
	req1.RemoteAddr = "198.51.100.41:1111"
	go mux.ServeHTTP(httptest.NewRecorder(), req1)

	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	req2 := httptest.NewRequest("GET", "/v1/stream", nil).WithContext(ctx2)
	req2.RemoteAddr = "198.51.100.42:1111"
	go mux.ServeHTTP(httptest.NewRecorder(), req2)

	time.Sleep(50 * time.Millisecond)

	req3 := httptest.NewRequest("GET", "/v1/stream", nil)
	req3.RemoteAddr = "198.51.100.43:1111"
	w3 := httptest.NewRecorder()
	mux.ServeHTTP(w3, req3)

	if w3.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for exceeding global SSE cap, got %d", w3.Code)
	}
}

func TestSecurity_SecurityHeadersEnforced(t *testing.T) {
	srv := setupTestServer()
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	headers := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "no-referrer",
	}

	for h, expected := range headers {
		if got := w.Header().Get(h); got != expected {
			t.Errorf("header %s: expected %q, got %q", h, expected, got)
		}
	}

	csp := w.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "default-src 'none'") {
		t.Errorf("expected strict CSP, got %q", csp)
	}
}

func TestSecurity_CORSExplicitPolicy(t *testing.T) {
	srv := setupTestServer()
	srv.SetCORSOrigins([]string{"https://oracle.thru.org", "https://analytics.thru.org"})

	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	reqAllowed := httptest.NewRequest("GET", "/v1/status", nil)
	reqAllowed.Header.Set("Origin", "https://oracle.thru.org")
	wAllowed := httptest.NewRecorder()
	mux.ServeHTTP(wAllowed, reqAllowed)
	if wAllowed.Header().Get("Access-Control-Allow-Origin") != "https://oracle.thru.org" {
		t.Errorf("expected Access-Control-Allow-Origin https://oracle.thru.org, got %q",
			wAllowed.Header().Get("Access-Control-Allow-Origin"))
	}

	reqDisallowed := httptest.NewRequest("GET", "/v1/status", nil)
	reqDisallowed.Header.Set("Origin", "https://phishing.site")
	wDisallowed := httptest.NewRecorder()
	mux.ServeHTTP(wDisallowed, reqDisallowed)
	if wDisallowed.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("expected empty CORS header for untrusted origin, got %q",
			wDisallowed.Header().Get("Access-Control-Allow-Origin"))
	}

	reqOptions := httptest.NewRequest("OPTIONS", "/v1/status", nil)
	reqOptions.Header.Set("Origin", "https://oracle.thru.org")
	wOptions := httptest.NewRecorder()
	mux.ServeHTTP(wOptions, reqOptions)
	if wOptions.Code != http.StatusNoContent {
		t.Errorf("expected 204 No Content for preflight, got %d", wOptions.Code)
	}
}

func TestSecurity_RequestBodyLimit(t *testing.T) {
	srv := setupTestServer()
	mux := http.NewServeMux()
	srv.RegisterRoutes(mux)

	oversized := bytes.Repeat([]byte("A"), 128*1024)
	req := httptest.NewRequest("POST", "/health", bytes.NewReader(oversized))
	w := httptest.NewRecorder()

	handler := srv.withSecurityHeaders(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err == nil {
			t.Errorf("expected error reading body exceeding 64KB")
		}
		w.WriteHeader(http.StatusOK)
	})

	handler(w, req)
}
