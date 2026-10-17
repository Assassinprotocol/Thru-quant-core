package main

type FeederState int

const (
	StateRunning FeederState = iota
	StateTripped
	StateHold
)

func (s FeederState) String() string {
	switch s {
	case StateRunning:
		return "RUNNING"
	case StateTripped:
		return "TRIPPED"
	case StateHold:
		return "HOLD"
	default:
		return "UNKNOWN"
	}
}

var knownSymbols = map[string]uint32{
	"BTCUSDT":   1,
	"ETHUSDT":   2,
	"SOLUSDT":   3,
	"APTUSDT":   4,
	"SUIUSDT":   5,
	"BNBUSDT":   6,
	"DOGEUSDT":  7,
	"XRPUSDT":   8,
	"AVAXUSDT":  9,
	"LINKUSDT":  10,
	"NEARUSDT":  11,
	"ARBUSDT":   12,
	"OPUSDT":    13,
	"TIAUSDT":   14,
	"INJUSDT":   15,
	"SEIUSDT":   16,
	"SUSDT":     17,
	"UNIUSDT":   18,
	"AAVEUSDT":  19,
	"TAOUSDT":   20,
	"PEPEUSDT":  21,
	"SHIBUSDT":  22,
	"WIFUSDT":   23,
	"BONKUSDT":  24,
	"RENDERUSDT": 25,
	"FETUSDT":   26,
	"FTMUSDT":   27,
	"KASUSDT":   28,
	"STXUSDT":   29,
	"FILUSDT":   30,
	"LTCUSDT":   31,
	"BCHUSDT":   32,
}

type MarketRecord struct {
	Timestamp float64 `json:"timestamp"`
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
}

type MarketRegime struct {
	Timestamp  string  `json:"timestamp"`
	Regime     string  `json:"regime"`
	Confidence float64 `json:"confidence"`
}

type OracleEntry struct {
	SymbolID      uint32
	PriceQ64Hi    uint64
	PriceQ64Lo    uint64
	VolatilityBps uint32
	Timestamp     uint32
}

type QuoteData struct {
	Price         float64
	SourceTime    uint32
	VolatilityBps uint32
}
