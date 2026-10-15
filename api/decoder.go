package api

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

const (
	OracleAccountExpectedSize = 948
	OracleHeaderSize          = 52
	OracleEntrySize           = 28
	MaxOracleSymbols          = 32
)

var (
	ErrBufferTooShort     = errors.New("binary buffer smaller than oracle header size (52 bytes)")
	ErrInvalidEntryCount  = errors.New("oracle entry count exceeds MAX_ORACLE_SYMBOLS (32)")
	ErrBufferTruncated    = errors.New("binary buffer truncated for declared entry count")
	ErrUnsupportedVersion = errors.New("unsupported oracle state version")
)

// DecodeOracleAccountBytes deserializes raw bytes into an OracleState struct
func DecodeOracleAccountBytes(raw []byte, nowSec uint32) (*OracleState, error) {
	if len(raw) < OracleHeaderSize {
		return nil, fmt.Errorf("%w: got %d bytes, need at least %d", ErrBufferTooShort, len(raw), OracleHeaderSize)
	}

	version := binary.LittleEndian.Uint32(raw[0:4])
	if version != 1 {
		return nil, fmt.Errorf("%w: expected 1, got %d", ErrUnsupportedVersion, version)
	}

	authority := hex.EncodeToString(raw[4:36])
	circuitBreaker := raw[36] != 0
	regimeID := binary.LittleEndian.Uint32(raw[40:44])
	lastUpdateTS := binary.LittleEndian.Uint32(raw[44:48])
	entryCount := binary.LittleEndian.Uint32(raw[48:52])

	if entryCount > MaxOracleSymbols {
		return nil, fmt.Errorf("%w: got %d", ErrInvalidEntryCount, entryCount)
	}

	requiredSize := OracleHeaderSize + int(entryCount)*OracleEntrySize
	if len(raw) < requiredSize {
		return nil, fmt.Errorf("%w: got %d bytes, need %d", ErrBufferTruncated, len(raw), requiredSize)
	}

	feedAgeSec := uint32(0)
	if nowSec > lastUpdateTS && lastUpdateTS > 0 {
		feedAgeSec = nowSec - lastUpdateTS
	}

	entries := make([]OracleEntry, 0, entryCount)
	offset := OracleHeaderSize

	for i := uint32(0); i < entryCount; i++ {
		symID := binary.LittleEndian.Uint32(raw[offset : offset+4])
		pHi := binary.LittleEndian.Uint64(raw[offset+4 : offset+12])
		pLo := binary.LittleEndian.Uint64(raw[offset+12 : offset+20])
		volBps := binary.LittleEndian.Uint32(raw[offset+20 : offset+24])
		ts := binary.LittleEndian.Uint32(raw[offset+24 : offset+28])
		offset += OracleEntrySize

		ageSec := uint32(0)
		if nowSec > ts && ts > 0 {
			ageSec = nowSec - ts
		}

		symName, ok := KnownSymbolMap[symID]
		if !ok {
			symName = fmt.Sprintf("UNKNOWN_%d", symID)
		}

		entries = append(entries, OracleEntry{
			SymbolID:      symID,
			Symbol:        symName,
			PriceQ64Hi:    pHi,
			PriceQ64Lo:    pLo,
			Price:         Q64ToFloat(pHi, pLo),
			VolatilityBps: volBps,
			Timestamp:     ts,
			AgeSec:        ageSec,
		})
	}

	return &OracleState{
		Version:              version,
		AuthorityPubkey:      authority,
		CircuitBreakerActive: circuitBreaker,
		RegimeID:             regimeID,
		RegimeName:           RegimeNameFromID(regimeID),
		LastUpdateTS:         lastUpdateTS,
		FeedAgeSec:           feedAgeSec,
		EntryCount:           entryCount,
		Entries:              entries,
		SourceMode:           "ON_CHAIN_DECODED",
	}, nil
}

// DecodeOracleAccountBase64 decodes a base64 encoded oracle data string
func DecodeOracleAccountBase64(b64Str string) (*OracleState, error) {
	raw, err := base64.StdEncoding.DecodeString(b64Str)
	if err != nil {
		return nil, fmt.Errorf("failed base64 decode: %w", err)
	}
	nowSec := uint32(time.Now().Unix())
	return DecodeOracleAccountBytes(raw, nowSec)
}
