package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"thru_quant_core/api"
)

type ThruAccountInfoResp struct {
	AccountInfo struct {
		Data           string `json:"data"`
		Slot           uint64 `json:"slot"`
		BlockTimestamp string `json:"blockTimestamp"`
		Pubkey         string `json:"pubkey"`
	} `json:"account_info"`
}

type MarketRecord struct {
	Timestamp float64 `json:"timestamp"`
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
}

type MarketRegime struct {
	Regime string `json:"regime"`
}

func main() {
	port := flag.String("port", "8080", "HTTP server port")
	oracleAccount := flag.String("oracle-account", "taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN", "Target on-chain Oracle storage account")
	programAddr := flag.String("program", "taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR", "Target on-chain Oracle program address")
	network := flag.String("network", "Betanet", "Thru Network cluster name")
	dataDir := flag.String("data-dir", "data", "Path to market data fallback directory")
	staticDir := flag.String("static-dir", "visualizer", "Path to visualizer web directory")
	pollInterval := flag.Duration("poll-interval", 5*time.Second, "On-chain state refresh interval")
	allowSnapshotFallback := flag.Bool("allow-snapshot-fallback", false, "Allow local snapshot failover in development mode")
	trustedProxies := flag.String("trusted-proxies", "", "Comma-separated list of trusted upstream proxy CIDRs (e.g. 127.0.0.1/32,10.0.0.0/8)")
	metricsToken := flag.String("metrics-token", os.Getenv("THRU_METRICS_TOKEN"), "Bearer token for external /metrics access (env: THRU_METRICS_TOKEN)")
	corsOrigins := flag.String("cors-origins", "*", "Comma-separated list of allowed CORS origins")
	maxSSEPerIP := flag.Int("max-sse-per-ip", 4, "Maximum active SSE stream clients per IP")
	maxSSEGlobal := flag.Int("max-sse-global", 256, "Maximum active SSE stream clients globally")
	flag.Parse()

	log.Printf("[THRU:API] Starting Thru Quant Oracle API Daemon on :%s", *port)
	log.Printf("[THRU:API] Target Network: %s | Program: %s | Account: %s", *network, *programAddr, *oracleAccount)

	server := api.NewServer(*programAddr, *oracleAccount, *network, *staticDir)
	if *trustedProxies != "" {
		if err := server.SetTrustedProxies(strings.Split(*trustedProxies, ",")); err != nil {
			log.Fatalf("[THRU:API:FATAL] Invalid trusted-proxies: %v", err)
		}
	}
	if *metricsToken != "" {
		server.SetMetricsToken(*metricsToken)
	}
	if *corsOrigins != "" {
		server.SetCORSOrigins(strings.Split(*corsOrigins, ","))
	}
	server.SetSSELimits(*maxSSEGlobal, *maxSSEPerIP)

	mux := http.NewServeMux()
	server.RegisterRoutes(mux)

	httpServer := &http.Server{
		Addr:              ":" + *port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Initial fetch
	fetchAndPublishState(server, *oracleAccount, *dataDir, *allowSnapshotFallback)

	// Background polling worker
	ticker := time.NewTicker(*pollInterval)
	stopWorker := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				fetchAndPublishState(server, *oracleAccount, *dataDir, *allowSnapshotFallback)
			case <-stopWorker:
				ticker.Stop()
				return
			}
		}
	}()

	// Start server in background
	go func() {
		log.Printf("[THRU:API] HTTP and SSE Server listening at http://localhost:%s/", *port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[THRU:API:FATAL] Server listen failed: %v", err)
		}
	}()

	// Graceful shutdown handling
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("[THRU:API] Initiating graceful shutdown...")
	close(stopWorker)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("[THRU:API:ERROR] Server shutdown error: %v", err)
	}
	server.Close()
	log.Println("[THRU:API] Daemon stopped cleanly.")
}

func fetchAndPublishState(srv *api.Server, accountAddr, dataDir string, allowFallback bool) {
	// Attempt 1: Fetch live on-chain state via Thru CLI / RPC with bounded context timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "thru", "account", "info", "--json", accountAddr)
	out, err := cmd.Output()
	if err == nil {
		var resp ThruAccountInfoResp
		if json.Unmarshal(out, &resp) == nil && resp.AccountInfo.Data != "" {
			// Security validation: ensure returned pubkey matches expected account
			if resp.AccountInfo.Pubkey != "" && resp.AccountInfo.Pubkey != accountAddr {
				log.Printf("[THRU:API:SECURITY] Account address mismatch: expected %s, got %s", accountAddr, resp.AccountInfo.Pubkey)
				srv.RecordRPCFailure()
				return
			}
			state, decodeErr := api.DecodeOracleAccountBase64(resp.AccountInfo.Data)
			if decodeErr == nil {
				state.SourceMode = "ON_CHAIN_ALPHANET"
				state.Slot = resp.AccountInfo.Slot
				state.BlockTimestamp = resp.AccountInfo.BlockTimestamp
				state.AccountAddress = resp.AccountInfo.Pubkey
				srv.UpdateState(state)
				log.Printf("[THRU:API:STATE] Synced ON-CHAIN Alphanet state: Slot %d | %d quotes | Breaker: %v",
					state.Slot, len(state.Entries), state.CircuitBreakerActive)
				return
			}
			log.Printf("[THRU:API:WARN] On-chain payload decode failed: %v", decodeErr)
		}
	} else {
		srv.RecordRPCFailure()
		log.Printf("[THRU:API:WARN] On-chain query failed: %v", err)
	}

	// Attempt 2: Optional fallback to local snapshot file only in explicit dev mode
	if allowFallback {
		state := readFallbackSnapshot(dataDir, accountAddr)
		if state != nil {
			state.SourceMode = "LOCAL_SNAPSHOT_FALLBACK_DEV"
			srv.UpdateState(state)
			log.Printf("[THRU:API:STATE] Running in LOCAL_SNAPSHOT_FALLBACK_DEV mode (%d quotes)", len(state.Entries))
		}
	} else {
		log.Printf("[THRU:API:FAIL_CLOSED] On-chain read failed and allow-snapshot-fallback is false; failing closed")
	}
}

func readFallbackSnapshot(dataDir, accountAddr string) *api.OracleState {
	historyPath := filepath.Join(dataDir, "market_history.json")
	bytes, err := os.ReadFile(historyPath)
	if err != nil {
		return nil
	}

	var records []MarketRecord
	if json.Unmarshal(bytes, &records) != nil {
		return nil
	}

	nowSec := uint32(time.Now().Unix())
	latestRecords := make(map[string]MarketRecord)
	for _, rec := range records {
		if rec.Price <= 0 {
			continue
		}
		if existing, ok := latestRecords[rec.Symbol]; !ok || rec.Timestamp > existing.Timestamp {
			latestRecords[rec.Symbol] = rec
		}
	}

	var entries []api.OracleEntry
	for sym, symID := range api.ReverseSymbolMap {
		if rec, ok := latestRecords[sym]; ok {
			ts := uint32(rec.Timestamp)
			if ts == 0 {
				ts = nowSec
			}
			age := uint32(0)
			if nowSec > ts {
				age = nowSec - ts
			}

			entries = append(entries, api.OracleEntry{
				SymbolID:      symID,
				Symbol:        sym,
				Price:         rec.Price,
				VolatilityBps: 150,
				Timestamp:     ts,
				AgeSec:        age,
			})
		}
	}

	regimeID := uint32(0)
	regimeBytes, err := os.ReadFile(filepath.Join(dataDir, "market_regime.json"))
	if err == nil {
		var mr MarketRegime
		if json.Unmarshal(regimeBytes, &mr) == nil {
			switch mr.Regime {
			case "trending_up":
				regimeID = 1
			case "trending_down":
				regimeID = 2
			case "high_volatility":
				regimeID = 3
			}
		}
	}

	return &api.OracleState{
		Version:              1,
		AuthorityPubkey:      "taIWL8iro1Jt8sNChWGgupC5tzqewzfjfSzp2pegCWYm0E",
		CircuitBreakerActive: false,
		RegimeID:             regimeID,
		RegimeName:           api.RegimeNameFromID(regimeID),
		LastUpdateTS:         nowSec,
		FeedAgeSec:           0,
		EntryCount:           uint32(len(entries)),
		Entries:              entries,
		SourceMode:           "LOCAL_SNAPSHOT_FAILOVER",
		Slot:                 7743340,
		AccountAddress:       accountAddr,
	}
}
