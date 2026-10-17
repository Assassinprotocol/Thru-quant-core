package main

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestFloatToQ64Roundtrip(t *testing.T) {
	testCases := []float64{
		0.0,
		1.0,
		0.00000001,
		0.5,
		42.12345678,
		83459.50,
		250000.12345,
	}

	for _, tc := range testCases {
		hi, lo := floatToQ64(tc)
		recovered := q64ToFloat(hi, lo)
		if tc == 0 {
			if recovered != 0 {
				t.Fatalf("expected 0, got %f", recovered)
			}
			continue
		}
		relErr := math.Abs(tc-recovered) / tc
		if relErr > 1e-12 {
			t.Fatalf("for %f: roundtrip recovered %f, relErr %e > 1e-12", tc, recovered, relErr)
		}
	}
}

func TestParseRegimeID(t *testing.T) {
	cases := []struct {
		input    string
		expected uint32
	}{
		{"TRENDING UP", 1},
		{"trending up", 1},
		{"TRENDING DOWN", 2},
		{"trending down", 2},
		{"VOLATILITY SPIKE", 3},
		{"HIGH VOLATILITY", 3},
		{"NEUTRAL", 0},
		{"RANGING", 0},
		{"", 0},
	}

	for _, c := range cases {
		got := parseRegimeID(c.input)
		if got != c.expected {
			t.Errorf("parseRegimeID(%q) = %d, expected %d", c.input, got, c.expected)
		}
	}
}

func TestCalculateRollingVolatilityBps(t *testing.T) {
	// Sample horizon < 10 returns 0
	shortSeries := []float64{100, 101, 102}
	if v := calculateRollingVolatilityBps(shortSeries); v != 0 {
		t.Fatalf("expected 0 for < 10 items, got %d", v)
	}

	// Constant price returns 0 bps
	constantSeries := make([]float64, 15)
	for i := range constantSeries {
		constantSeries[i] = 100.0
	}
	if v := calculateRollingVolatilityBps(constantSeries); v != 0 {
		t.Fatalf("expected 0 for constant series, got %d", v)
	}

	// Volatile series returns non-zero bps
	volatileSeries := []float64{100, 105, 95, 110, 90, 108, 92, 115, 88, 120, 85, 125}
	if v := calculateRollingVolatilityBps(volatileSeries); v == 0 {
		t.Fatalf("expected >0 for volatile series, got %d", v)
	}
}

func TestBuildOracleUpdatePayload(t *testing.T) {
	quotes := map[string]QuoteData{
		"BTCUSDT": {Price: 83459.50, SourceTime: 1700000050, VolatilityBps: 150},
		"ETHUSDT": {Price: 3200.25, SourceTime: 1700000045, VolatilityBps: 200},
	}
	lastPublished := make(map[uint32]uint32)

	payload, entries := buildOracleUpdatePayload(2, 1, quotes, lastPublished)
	if len(entries) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(entries))
	}

	expectedLen := OraclePayloadHeaderSize + OracleEntryWireSize*2
	if len(payload) != expectedLen {
		t.Fatalf("expected payload len %d, got %d", expectedLen, len(payload))
	}

	opcode := binary.LittleEndian.Uint32(payload[0:4])
	if opcode != 1 {
		t.Fatalf("expected opcode 1 for UPDATE, got %d", opcode)
	}

	acctIdx := binary.LittleEndian.Uint16(payload[4:6])
	if acctIdx != 2 {
		t.Fatalf("expected account index 2, got %d", acctIdx)
	}

	regimeID := binary.LittleEndian.Uint32(payload[6:10])
	if regimeID != 1 {
		t.Fatalf("expected regimeID 1, got %d", regimeID)
	}

	maxTs := binary.LittleEndian.Uint32(payload[10:14])
	if maxTs != 1700000050 {
		t.Fatalf("expected maxTs 1700000050, got %d", maxTs)
	}

	entryCount := binary.LittleEndian.Uint32(payload[14:18])
	if entryCount != 2 {
		t.Fatalf("expected entryCount 2, got %d", entryCount)
	}
}

func TestBuildOracleRebasePayload(t *testing.T) {
	quotes := map[string]QuoteData{
		"BTCUSDT": {Price: 90000.0, SourceTime: 1700000100, VolatilityBps: 300},
	}

	payload, entries := buildOracleRebasePayload(5, 0, quotes, nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}

	expectedLen := OraclePayloadHeaderSize + OracleEntryWireSize*1
	if len(payload) != expectedLen {
		t.Fatalf("expected payload len %d, got %d", expectedLen, len(payload))
	}

	opcode := binary.LittleEndian.Uint32(payload[0:4])
	if opcode != 3 {
		t.Fatalf("expected opcode 3 for REBASE, got %d", opcode)
	}

	acctIdx := binary.LittleEndian.Uint16(payload[4:6])
	if acctIdx != 5 {
		t.Fatalf("expected account index 5, got %d", acctIdx)
	}
}

func TestBuildOracleResumePayload(t *testing.T) {
	payload := buildOracleResumePayload(3)
	if len(payload) != 6 {
		t.Fatalf("expected 6 bytes for resume payload, got %d", len(payload))
	}

	opcode := binary.LittleEndian.Uint32(payload[0:4])
	if opcode != 2 {
		t.Fatalf("expected opcode 2 for RESUME, got %d", opcode)
	}

	acctIdx := binary.LittleEndian.Uint16(payload[4:6])
	if acctIdx != 3 {
		t.Fatalf("expected accountIdx 3, got %d", acctIdx)
	}
}

func TestTimestampMonotonicityAndStaleness(t *testing.T) {
	btcID := knownSymbols["BTCUSDT"]
	lastPublished := map[uint32]uint32{
		btcID: 1700000050,
	}

	// 1. Regressed quote should be skipped
	regressedQuotes := map[string]QuoteData{
		"BTCUSDT": {Price: 83000.0, SourceTime: 1700000040, VolatilityBps: 100}, // regressed
	}
	payload, entries := buildOracleUpdatePayload(2, 0, regressedQuotes, lastPublished)
	if payload != nil || len(entries) != 0 {
		t.Fatalf("expected regressed quote to be filtered out, got %d entries", len(entries))
	}

	// 2. Monotonic quote should succeed and advance lastPublished
	advanceQuotes := map[string]QuoteData{
		"BTCUSDT": {Price: 83500.0, SourceTime: 1700000060, VolatilityBps: 100},
	}
	payload, entries = buildOracleUpdatePayload(2, 0, advanceQuotes, lastPublished)
	if len(entries) != 1 || payload == nil {
		t.Fatalf("expected monotonic quote to be included, got %d entries", len(entries))
	}
	if lastPublished[btcID] != 1700000060 {
		t.Fatalf("expected lastPublished to update to 1700000060, got %d", lastPublished[btcID])
	}

	// 3. Stale quote (> 120s from max timestamp in batch) should be filtered
	batchQuotes := map[string]QuoteData{
		"BTCUSDT": {Price: 83500.0, SourceTime: 1700000200, VolatilityBps: 100}, // maxTs = 1700000200
		"ETHUSDT": {Price: 3200.0, SourceTime: 1700000050, VolatilityBps: 100},  // diff = 150s > 120s
	}
	_, batchEntries := buildOracleUpdatePayload(2, 0, batchQuotes, nil)
	if len(batchEntries) != 1 {
		t.Fatalf("expected stale ETH quote to be filtered out, got %d entries", len(batchEntries))
	}
	if batchEntries[0].SymbolID != btcID {
		t.Fatalf("expected only BTC quote to survive staleness filter, got symbolID %d", batchEntries[0].SymbolID)
	}
}

func TestClassifyTxOutput(t *testing.T) {
	testCases := []struct {
		name     string
		output   string
		err      error
		expected TxResultType
	}{
		{
			name:     "Success execution",
			output:   "Transaction executed successfully. Hash: 0x123",
			err:      nil,
			expected: TxResultSuccess,
		},
		{
			name:     "Circuit breaker tripped code 0x200B",
			output:   "Transaction reverted: error code 0x200B",
			err:      errors.New("exit 1"),
			expected: TxResultTripped,
		},
		{
			name:     "Circuit breaker tripped decimal 8203",
			output:   "Instruction failed: Custom error 8203",
			err:      errors.New("exit 1"),
			expected: TxResultTripped,
		},
		{
			name:     "Price limit exceeded 0x2007",
			output:   "Error: price limit exceeded (0x2007)",
			err:      errors.New("exit 1"),
			expected: TxResultTripped,
		},
		{
			name:     "Timeout error",
			output:   "RPC failed: context deadline exceeded",
			err:      errors.New("deadline exceeded"),
			expected: TxResultTimeout,
		},
		{
			name:     "Generic revert",
			output:   "Transaction execution failed: reverted",
			err:      errors.New("exit 1"),
			expected: TxResultRevert,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := ClassifyTxOutput(tc.output, tc.err)
			if got != tc.expected {
				t.Fatalf("ClassifyTxOutput got %v, expected %v", got, tc.expected)
			}
		})
	}
}

func TestOperatorAuditLogging(t *testing.T) {
	tmpDir := t.TempDir()
	auditFile := filepath.Join(tmpDir, "test_audit.log")

	err := recordOperatorAudit(auditFile, "REBASE", "0xoperator", "0xprogram", "0xaccount", "deadbeef", "SUCCESS", "baseline reset")
	if err != nil {
		t.Fatalf("failed to record operator audit: %v", err)
	}

	content, err := os.ReadFile(auditFile)
	if err != nil {
		t.Fatalf("failed to read audit file: %v", err)
	}

	var entry AuditLogEntry
	if err := json.Unmarshal(content, &entry); err != nil {
		t.Fatalf("failed to parse audit log json: %v", err)
	}

	if entry.Action != "REBASE" {
		t.Fatalf("expected action REBASE, got %s", entry.Action)
	}
	if entry.Signer != "0xoperator" {
		t.Fatalf("expected signer 0xoperator, got %s", entry.Signer)
	}
	if entry.Status != "SUCCESS" {
		t.Fatalf("expected status SUCCESS, got %s", entry.Status)
	}
	if entry.PayloadHex != "deadbeef" {
		t.Fatalf("expected payload_hex deadbeef, got %s", entry.PayloadHex)
	}
}

func TestFeederStateString(t *testing.T) {
	if StateRunning.String() != "RUNNING" {
		t.Fatalf("expected RUNNING, got %s", StateRunning.String())
	}
	if StateTripped.String() != "TRIPPED" {
		t.Fatalf("expected TRIPPED, got %s", StateTripped.String())
	}
	if StateHold.String() != "HOLD" {
		t.Fatalf("expected HOLD, got %s", StateHold.String())
	}
	if FeederState(99).String() != "UNKNOWN" {
		t.Fatalf("expected UNKNOWN, got %s", FeederState(99).String())
	}

	if TxResultSuccess.String() != "SUCCESS" ||
		TxResultTripped.String() != "CIRCUIT_BREAKER_TRIPPED" ||
		TxResultRevert.String() != "REVERT" ||
		TxResultTimeout.String() != "TIMEOUT" ||
		TxResultUnknown.String() != "UNKNOWN" ||
		TxResultType(99).String() != "UNKNOWN" {
		t.Fatalf("TxResultType.String mismatch")
	}
}

func TestReadLocalMarketData(t *testing.T) {
	tmpDir := t.TempDir()
	now := float64(time.Now().Unix())

	records := []MarketRecord{
		{Timestamp: now - 10, Symbol: "BTCUSDT", Price: 83000.0},
		{Timestamp: now - 5, Symbol: "BTCUSDT", Price: 83500.0},
		{Timestamp: now - 5, Symbol: "ETHUSDT", Price: 3200.0},
		{Timestamp: now - 200, Symbol: "APTUSDT", Price: 10.0}, // Stale (> 120s)
		{Timestamp: 0, Symbol: "SOLUSDT", Price: 150.0},       // Missing timestamp
	}
	histBytes, _ := json.Marshal(records)
	if err := os.WriteFile(filepath.Join(tmpDir, "market_history.json"), histBytes, 0644); err != nil {
		t.Fatalf("failed writing test history: %v", err)
	}

	regime := MarketRegime{
		Regime:     "TRENDING UP",
		Confidence: 0.95,
	}
	regimeBytes, _ := json.Marshal(regime)
	if err := os.WriteFile(filepath.Join(tmpDir, "market_regime.json"), regimeBytes, 0644); err != nil {
		t.Fatalf("failed writing test regime: %v", err)
	}

	quotes, regimeID, err := readLocalMarketData(tmpDir)
	if err != nil {
		t.Fatalf("readLocalMarketData failed: %v", err)
	}

	if regimeID != 1 {
		t.Fatalf("expected regimeID 1, got %d", regimeID)
	}

	if _, ok := quotes["BTCUSDT"]; !ok {
		t.Fatalf("expected BTCUSDT in quotes")
	}
	if _, ok := quotes["ETHUSDT"]; !ok {
		t.Fatalf("expected ETHUSDT in quotes")
	}
	if _, ok := quotes["APTUSDT"]; ok {
		t.Fatalf("expected stale APTUSDT to be excluded")
	}
	if _, ok := quotes["SOLUSDT"]; ok {
		t.Fatalf("expected zero-ts SOLUSDT to be excluded")
	}
}

