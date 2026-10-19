package main

import "thru_quant_core/api"

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

var knownSymbols = api.ReverseSymbolMap

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
