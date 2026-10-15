package api

import (
	"math"
)

// KnownSymbolMap maps numeric symbol IDs to canonical market tickers (matching feeder/main.go)
var KnownSymbolMap = map[uint32]string{
	1:  "BTCUSDT",
	2:  "ETHUSDT",
	3:  "SOLUSDT",
	4:  "APTUSDT",
	5:  "SUIUSDT",
	6:  "BNBUSDT",
	7:  "DOGEUSDT",
	8:  "XRPUSDT",
	9:  "AVAXUSDT",
	10: "LINKUSDT",
	11: "NEARUSDT",
	12: "ARBUSDT",
	13: "OPUSDT",
	14: "TIAUSDT",
	15: "INJUSDT",
	16: "SEIUSDT",
	17: "SUSDT",
	18: "UNIUSDT",
	19: "AAVEUSDT",
	20: "TAOUSDT",
	21: "PEPEUSDT",
	22: "SHIBUSDT",
	23: "WIFUSDT",
	24: "BONKUSDT",
	25: "RENDERUSDT",
	26: "FETUSDT",
	27: "FTMUSDT",
	28: "KASUSDT",
	29: "STXUSDT",
	30: "FILUSDT",
	31: "LTCUSDT",
	32: "BCHUSDT",
}

// ReverseSymbolMap maps ticker names to symbol IDs
var ReverseSymbolMap = map[string]uint32{
	"BTCUSDT":    1,
	"ETHUSDT":    2,
	"SOLUSDT":    3,
	"APTUSDT":    4,
	"SUIUSDT":    5,
	"BNBUSDT":    6,
	"DOGEUSDT":   7,
	"XRPUSDT":    8,
	"AVAXUSDT":   9,
	"LINKUSDT":   10,
	"NEARUSDT":   11,
	"ARBUSDT":    12,
	"OPUSDT":     13,
	"TIAUSDT":    14,
	"INJUSDT":    15,
	"SEIUSDT":    16,
	"SUSDT":      17,
	"UNIUSDT":    18,
	"AAVEUSDT":   19,
	"TAOUSDT":    20,
	"PEPEUSDT":   21,
	"SHIBUSDT":   22,
	"WIFUSDT":    23,
	"BONKUSDT":   24,
	"RENDERUSDT": 25,
	"FETUSDT":    26,
	"FTMUSDT":    27,
	"KASUSDT":    28,
	"STXUSDT":    29,
	"FILUSDT":    30,
	"LTCUSDT":    31,
	"BCHUSDT":    32,
}

// OracleEntry represents an individual asset quote decoded from binary
type OracleEntry struct {
	SymbolID      uint32  `json:"symbol_id"`
	Symbol        string  `json:"symbol"`
	PriceQ64Hi    uint64  `json:"price_q64_hi"`
	PriceQ64Lo    uint64  `json:"price_q64_lo"`
	Price         float64 `json:"price"`
	VolatilityBps uint32  `json:"volatility_bps"`
	Timestamp     uint32  `json:"timestamp"`
	AgeSec        uint32  `json:"age_sec"`
}

// OracleState represents the entire unpacked on-chain oracle storage
type OracleState struct {
	Version              uint32        `json:"version"`
	AuthorityPubkey      string        `json:"authority_pubkey"`
	CircuitBreakerActive bool          `json:"circuit_breaker_active"`
	RegimeID             uint32        `json:"regime_id"`
	RegimeName           string        `json:"regime_name"`
	LastUpdateTS         uint32        `json:"last_update_ts"`
	FeedAgeSec           uint32        `json:"feed_age_sec"`
	EntryCount           uint32        `json:"entry_count"`
	Entries              []OracleEntry `json:"entries"`
	SourceMode           string        `json:"source_mode"`
	Slot                 uint64        `json:"slot"`
	BlockTimestamp       string        `json:"block_timestamp"`
	AccountAddress       string        `json:"account_address"`
}

// HealthResponse represents system liveness and data health
type HealthResponse struct {
	Status               string `json:"status"` // "healthy", "stale", "degraded"
	FeedAgeSec           uint32 `json:"feed_age_sec"`
	CircuitBreakerActive bool   `json:"circuit_breaker_active"`
	Source               string `json:"source"`
	Slot                 uint64 `json:"slot"`
	TrackedAssets        int    `json:"tracked_assets"`
	UptimeSec            int64  `json:"uptime_sec"`
}

// StatusResponse represents network and deployment metadata
type StatusResponse struct {
	Network              string `json:"network"`
	ProgramAddress       string `json:"program_address"`
	AccountAddress       string `json:"account_address"`
	Slot                 uint64 `json:"slot"`
	CircuitBreakerActive bool   `json:"circuit_breaker_active"`
	Regime               string `json:"regime"`
	FeedAgeSec           uint32 `json:"feed_age_sec"`
	QuoteCount           int    `json:"quote_count"`
	SourceMode           string `json:"source_mode"`
	LastUpdateTS         uint32 `json:"last_update_ts"`
}

// Q64ToFloat converts Q64.64 hi/lo words into float64
func Q64ToFloat(hi uint64, lo uint64) float64 {
	return float64(hi) + (float64(lo) / math.Pow(2, 64))
}

// RegimeNameFromID maps numeric regime ID to descriptive human-readable label
func RegimeNameFromID(id uint32) string {
	switch id {
	case 1:
		return "TRENDING_UP"
	case 2:
		return "TRENDING_DOWN"
	case 3:
		return "HIGH_VOLATILITY"
	default:
		return "NEUTRAL_SIDEWAYS"
	}
}
