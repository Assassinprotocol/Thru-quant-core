package main

import (
	"bytes"
	"encoding/binary"
	"log"
)

const (
	OraclePayloadHeaderSize = 18 // 4 (opcode) + 2 (account_idx) + 4 (regime) + 4 (ts) + 4 (count)
	OracleEntryWireSize     = 28 // 4 (sym) + 8 (hi) + 8 (lo) + 4 (vol) + 4 (ts)
	MaxOracleEntries        = 32
)

func buildOraclePayload(opcode uint32, accountIdx uint16, regimeID uint32, quotes map[string]QuoteData, lastPublished map[uint32]uint32) ([]byte, []OracleEntry) {
	buf := new(bytes.Buffer)
	maxSourceTime := uint32(0)

	var entries []OracleEntry
	for sym, symID := range knownSymbols {
		if q, ok := quotes[sym]; ok && q.Price > 0 && q.SourceTime > 0 {
			// Invariant C3: entry timestamp cannot regress past last published timestamp
			if lastPublished != nil {
				if lastTs, exists := lastPublished[symID]; exists && q.SourceTime < lastTs {
					log.Printf("feeder: quote %s timestamp regressed (%d < %d), skipping", sym, q.SourceTime, lastTs)
					continue
				}
			}
			hi, lo := floatToQ64(q.Price)
			if q.SourceTime > maxSourceTime {
				maxSourceTime = q.SourceTime
			}
			entries = append(entries, OracleEntry{
				SymbolID:      symID,
				PriceQ64Hi:    hi,
				PriceQ64Lo:    lo,
				VolatilityBps: q.VolatilityBps,
				Timestamp:     q.SourceTime,
			})
		}
		if len(entries) >= MaxOracleEntries {
			break
		}
	}

	if len(entries) == 0 {
		return nil, nil
	}

	// Filter entries so that none is older than 120s from maxSourceTime
	var validEntries []OracleEntry
	for _, e := range entries {
		if maxSourceTime >= e.Timestamp && (maxSourceTime-e.Timestamp) <= 120 {
			validEntries = append(validEntries, e)
			if lastPublished != nil {
				lastPublished[e.SymbolID] = e.Timestamp
			}
		}
	}

	if len(validEntries) == 0 {
		return nil, nil
	}

	// Header: instruction_type (u32), oracle_account_idx (u16), regime_id (u32), timestamp (u32), entry_count (u32)
	binary.Write(buf, binary.LittleEndian, opcode)
	binary.Write(buf, binary.LittleEndian, accountIdx)
	binary.Write(buf, binary.LittleEndian, regimeID)
	binary.Write(buf, binary.LittleEndian, maxSourceTime)
	binary.Write(buf, binary.LittleEndian, uint32(len(validEntries)))

	// Body: oracle_entry entries
	for _, e := range validEntries {
		binary.Write(buf, binary.LittleEndian, e.SymbolID)
		binary.Write(buf, binary.LittleEndian, e.PriceQ64Hi)
		binary.Write(buf, binary.LittleEndian, e.PriceQ64Lo)
		binary.Write(buf, binary.LittleEndian, e.VolatilityBps)
		binary.Write(buf, binary.LittleEndian, e.Timestamp)
	}

	return buf.Bytes(), validEntries
}

func buildOracleUpdatePayload(accountIdx uint16, regimeID uint32, quotes map[string]QuoteData, lastPublished map[uint32]uint32) ([]byte, []OracleEntry) {
	return buildOraclePayload(1, accountIdx, regimeID, quotes, lastPublished)
}

func buildOracleRebasePayload(accountIdx uint16, regimeID uint32, quotes map[string]QuoteData, lastPublished map[uint32]uint32) ([]byte, []OracleEntry) {
	return buildOraclePayload(3, accountIdx, regimeID, quotes, lastPublished)
}

func buildOracleResumePayload(accountIdx uint16) []byte {
	buf := new(bytes.Buffer)
	// Header: instruction_type (u32 = 2, ORACLE_INSTR_RESUME), oracle_account_idx (u16)
	binary.Write(buf, binary.LittleEndian, uint32(2))
	binary.Write(buf, binary.LittleEndian, accountIdx)
	return buf.Bytes()
}
