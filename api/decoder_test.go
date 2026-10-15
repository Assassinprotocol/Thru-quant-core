package api

import (
	"encoding/binary"
	"testing"
)

// Real on-chain base64 account data captured from Thru Alphanet Slot 7743340
// Account: taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN
const realAlphanetBase64 = "AQAAACFi/Iq6NSbfLDQoVhoLqQubc6nsM3430s6dqXoAlmJtAAAAAAAAAAAtRM9qHAAAABwAAAAAAAAAAAAAAIDDfHkB9tEJlgAAAC1Ez2oEAAAAAAAAAAAAAAAAKMKGp1fK0pYAAAAtRM9qBQAAAAEAAAAAAAAAAPB14JwRpQ2WAAAALUTPahcAAAAAAAAAAAAAAABm9+RhodY0lgAAAC1Ez2oBAAAAA0YBAAAAAAAAAAAAAAAAgJYAAAAtRM9qAgAAAMoJAAAAAAAAAAAAKVyPwnWWAAAALUTPagYAAADmAgAAAAAAAAAAgML1KFyPlgAAAC1Ez2oJAAAACgAAAAAAAAAAgDeJQWDlMJYAAAAtRM9qDAAAAAAAAAAAAAAAANgN2xZlNjCWAAAALUTPag0AAAAAAAAAAAAAAAC6LCY2H9cmlgAAAC1Ez2oPAAAACAAAAAAAAAAAAM/3U+OlG5YAAAAtRM9qAwAAAGsAAAAAAAAAAABcj8L1KByWAAAALUTPahAAAAAAAAAAAAAAAAAeG4F4Xb8QlgAAAC1Ez2oSAAAABwAAAAAAAAAAgJVDi2znW5YAAAAtRM9qCAAAAAEAAAAAAAAAAOAdp+hILl+WAAAALUTPagoAAAAMAAAAAAAAAACAGARWDi3ylgAAAC1Ez2oUAAAAGAEAAAAAAAAAAJDC9Shcj5YAAAAtRM9qGQAAAAEAAAAAAAAAAGDl0CLb+f6WAAAALUTPahoAAAAAAAAAAAAAAAC+DpwzorQ3lgAAAC1Ez2oeAAAAAQAAAAAAAAAAwNMrZRniKJYAAAAtRM9qIAAAABYBAAAAAAAAAADQzMzMzIyWAAAALUTPahEAAAAAAAAAAAAAAID9ZffkYaEOlgAAAC1Ez2odAAAAAAAAAAAAAAAAWKg1zTtOcZYAAAAtRM9qHwAAAD0AAAAAAAAAAAAAAAAAAMCWAAAALUTPagcAAAAAAAAAAAAAAAD3deCcEaUVlgAAAC1Ez2oOAAAAAAAAAAAAAAAAgATFjzF3jZYAAAAtRM9qEwAAAJ8AAAAAAAAAAACYmZmZmdmWAAAALUTPagsAAAAFAAAAAAAAAABAtvP91HgJlgAAAC1Ez2oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

func TestDecodeRealOnChainAccount(t *testing.T) {
	state, err := DecodeOracleAccountBase64(realAlphanetBase64)
	if err != nil {
		t.Fatalf("failed decoding real Alphanet data: %v", err)
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

	// Verify BTC price exists and is plausible (> $50,000)
	var btcEntry *OracleEntry
	for i := range state.Entries {
		if state.Entries[i].SymbolID == 1 {
			btcEntry = &state.Entries[i]
			break
		}
	}

	if btcEntry == nil {
		t.Fatalf("BTCUSDT (sym 1) not found in decoded entries")
	}

	if btcEntry.Price < 50000.0 || btcEntry.Price > 150000.0 {
		t.Errorf("unexpected BTC price: $%.2f", btcEntry.Price)
	}

	if btcEntry.Symbol != "BTCUSDT" {
		t.Errorf("expected symbol BTCUSDT, got %s", btcEntry.Symbol)
	}

	if btcEntry.VolatilityBps != 150 {
		t.Errorf("expected volatility 150 bps, got %d", btcEntry.VolatilityBps)
	}

	t.Logf("[VERIFIED] Successfully decoded real on-chain Oracle state: %d assets, BTC price: $%.2f", len(state.Entries), btcEntry.Price)
}

func TestDecodeValidationErrors(t *testing.T) {
	// 1. Buffer too short
	shortBuf := make([]byte, 20)
	_, err := DecodeOracleAccountBytes(shortBuf, 0)
	if err == nil {
		t.Errorf("expected error for short buffer, got nil")
	}

	// 2. Unsupported version
	badVerBuf := make([]byte, OracleHeaderSize)
	binary.LittleEndian.PutUint32(badVerBuf[0:4], 2)
	_, err = DecodeOracleAccountBytes(badVerBuf, 0)
	if err == nil {
		t.Errorf("expected error for version 2, got nil")
	}

	// 3. Entry count > 32
	excessiveEntriesBuf := make([]byte, OracleHeaderSize)
	binary.LittleEndian.PutUint32(excessiveEntriesBuf[0:4], 1)
	binary.LittleEndian.PutUint32(excessiveEntriesBuf[48:52], 33)
	_, err = DecodeOracleAccountBytes(excessiveEntriesBuf, 0)
	if err == nil {
		t.Errorf("expected error for entry_count 33, got nil")
	}
}

func TestQ64ToFloat(t *testing.T) {
	cases := []struct {
		hi       uint64
		lo       uint64
		expected float64
	}{
		{hi: 1, lo: 0, expected: 1.0},
		{hi: 0, lo: 1 << 63, expected: 0.5},
		{hi: 2500, lo: 0, expected: 2500.0},
		{hi: 80000, lo: 1 << 63, expected: 80000.5},
	}

	for _, tc := range cases {
		got := Q64ToFloat(tc.hi, tc.lo)
		if got != tc.expected {
			t.Errorf("Q64ToFloat(%d, %d) = %f; want %f", tc.hi, tc.lo, got, tc.expected)
		}
	}
}
