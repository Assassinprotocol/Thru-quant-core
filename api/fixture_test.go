package api

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFixturesCanonicalState(t *testing.T) {
	hexPath := filepath.Join("..", "testdata", "fixtures", "oracle_state_alphanet_slot_7743340.hex")
	hexBytes, err := os.ReadFile(hexPath)
	if err != nil {
		t.Fatalf("failed reading hex fixture: %v", err)
	}

	raw, err := hex.DecodeString(strings.TrimSpace(string(hexBytes)))
	if err != nil {
		t.Fatalf("failed decoding hex: %v", err)
	}

	if len(raw) != OracleAccountExpectedSize {
		t.Fatalf("expected %d bytes, got %d", OracleAccountExpectedSize, len(raw))
	}

	state, err := DecodeOracleAccountBytes(raw, 0)
	if err != nil {
		t.Fatalf("failed decoding oracle state: %v", err)
	}

	if state.Version != 1 {
		t.Errorf("expected version 1, got %d", state.Version)
	}

	if state.CircuitBreakerActive {
		t.Errorf("expected circuit breaker inactive, got active")
	}

	if state.EntryCount != 28 {
		t.Errorf("expected 28 entries, got %d", state.EntryCount)
	}

	if len(state.Entries) != 28 {
		t.Errorf("expected 28 parsed entries, got %d", len(state.Entries))
	}

	// Verify specific canonical symbols
	foundBTC := false
	foundETH := false
	foundSOL := false
	for _, e := range state.Entries {
		switch e.SymbolID {
		case 1:
			foundBTC = true
			if e.Symbol != "BTCUSDT" {
				t.Errorf("expected BTCUSDT, got %s", e.Symbol)
			}
			if e.Price < 50000 || e.Price > 150000 {
				t.Errorf("BTC price out of expected range: %f", e.Price)
			}
			if e.VolatilityBps != 150 {
				t.Errorf("expected BTC volatility 150 bps, got %d", e.VolatilityBps)
			}
		case 2:
			foundETH = true
			if e.Symbol != "ETHUSDT" {
				t.Errorf("expected ETHUSDT, got %s", e.Symbol)
			}
		case 3:
			foundSOL = true
			if e.Symbol != "SOLUSDT" {
				t.Errorf("expected SOLUSDT, got %s", e.Symbol)
			}
		}
	}

	if !foundBTC || !foundETH || !foundSOL {
		t.Errorf("missing core assets in decoded entries: BTC=%v ETH=%v SOL=%v", foundBTC, foundETH, foundSOL)
	}

	// Generate or verify golden JSON
	jsonPath := filepath.Join("..", "testdata", "fixtures", "oracle_state_alphanet_slot_7743340.json")
	if _, err := os.Stat(jsonPath); os.IsNotExist(err) {
		jsonData, err := json.MarshalIndent(state, "", "  ")
		if err != nil {
			t.Fatalf("failed marshaling golden json: %v", err)
		}
		if err := os.WriteFile(jsonPath, jsonData, 0644); err != nil {
			t.Fatalf("failed writing golden json: %v", err)
		}
		t.Logf("Generated golden JSON fixture at %s", jsonPath)
	} else {
		existingData, err := os.ReadFile(jsonPath)
		if err != nil {
			t.Fatalf("failed reading existing golden json: %v", err)
		}
		var goldenState OracleState
		if err := json.Unmarshal(existingData, &goldenState); err != nil {
			t.Fatalf("failed unmarshaling golden json: %v", err)
		}
		if goldenState.Version != state.Version || goldenState.EntryCount != state.EntryCount {
			t.Errorf("state mismatch with golden JSON: version %d vs %d, entries %d vs %d",
				state.Version, goldenState.Version, state.EntryCount, goldenState.EntryCount)
		}
	}
}

func TestFixturesCircuitBreaker(t *testing.T) {
	cbPath := filepath.Join("..", "testdata", "fixtures", "oracle_state_circuit_breaker.hex")
	hexBytes, err := os.ReadFile(cbPath)
	if err != nil {
		t.Fatalf("failed reading circuit breaker hex: %v", err)
	}

	raw, err := hex.DecodeString(strings.TrimSpace(string(hexBytes)))
	if err != nil {
		t.Fatalf("failed decoding hex: %v", err)
	}

	state, err := DecodeOracleAccountBytes(raw, 0)
	if err != nil {
		t.Fatalf("failed decoding circuit breaker state: %v", err)
	}

	if !state.CircuitBreakerActive {
		t.Errorf("expected circuit breaker ACTIVE, got inactive")
	}
}

func TestFixturesResumeInstruction(t *testing.T) {
	resumePath := filepath.Join("..", "testdata", "fixtures", "oracle_resume_instruction.hex")
	hexBytes, err := os.ReadFile(resumePath)
	if err != nil {
		t.Fatalf("failed reading resume hex: %v", err)
	}

	hexStr := strings.TrimSpace(string(hexBytes))
	if hexStr != "020000000200" {
		t.Errorf("expected canonical resume hex 020000000200, got %s", hexStr)
	}
}
