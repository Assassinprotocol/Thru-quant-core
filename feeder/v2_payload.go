package main

import (
	"bytes"
	"encoding/binary"
	"math"
)

const (
	OpcodeV2InitializeRegistry = uint32(1)
	OpcodeV2SubmitPrices       = uint32(2)
	OpcodeV2Aggregate          = uint32(3)
	OpcodeV2EmergencyPause     = uint32(6)
	OpcodeV2EmergencyResume    = uint32(7)
)

type V2RawQuote struct {
	SymbolID uint32
	Reserved uint32
	Price    uint64
	SourceTs uint64
}

func PriceToFixed8(price float64) uint64 {
	if price <= 0 || math.IsNaN(price) || math.IsInf(price, 0) {
		return 0
	}
	return uint64(math.Round(price * 1e8))
}

func Fixed8ToPrice(fixed uint64) float64 {
	return float64(fixed) / 1e8
}

func BuildV2SubmitPayload(registryAccIdx, submissionAccIdx uint16, seq uint64, quotes map[string]QuoteData) []byte {
	var rawQuotes []V2RawQuote
	for sym, symID := range knownSymbols {
		if q, ok := quotes[sym]; ok && q.Price > 0 && q.SourceTime > 0 {
			rawQuotes = append(rawQuotes, V2RawQuote{
				SymbolID: symID,
				Reserved: 0,
				Price:    PriceToFixed8(q.Price),
				SourceTs: uint64(q.SourceTime),
			})
		}
	}

	if len(rawQuotes) == 0 {
		return nil
	}

	buf := new(bytes.Buffer)
	_ = binary.Write(buf, binary.LittleEndian, OpcodeV2SubmitPrices)
	_ = binary.Write(buf, binary.LittleEndian, registryAccIdx)
	_ = binary.Write(buf, binary.LittleEndian, submissionAccIdx)
	_ = binary.Write(buf, binary.LittleEndian, seq)
	_ = binary.Write(buf, binary.LittleEndian, uint32(len(rawQuotes)))

	for _, q := range rawQuotes {
		_ = binary.Write(buf, binary.LittleEndian, q.SymbolID)
		_ = binary.Write(buf, binary.LittleEndian, q.Reserved)
		_ = binary.Write(buf, binary.LittleEndian, q.Price)
		_ = binary.Write(buf, binary.LittleEndian, q.SourceTs)
	}

	return buf.Bytes()
}

func BuildV2AggregatePayload(registryAccIdx, feedAccIdx uint16, symbolID uint32, subIndices [7]uint16) []byte {
	buf := new(bytes.Buffer)
	_ = binary.Write(buf, binary.LittleEndian, OpcodeV2Aggregate)
	_ = binary.Write(buf, binary.LittleEndian, registryAccIdx)
	_ = binary.Write(buf, binary.LittleEndian, feedAccIdx)
	_ = binary.Write(buf, binary.LittleEndian, symbolID)
	for i := 0; i < 7; i++ {
		_ = binary.Write(buf, binary.LittleEndian, subIndices[i])
	}
	return buf.Bytes()
}
