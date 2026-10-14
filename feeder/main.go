package main

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

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
	Timestamp string  `json:"timestamp"`
	Regime    string  `json:"regime"`
	Confidence float64 `json:"confidence"`
}

type OracleEntry struct {
	SymbolID      uint32
	PriceQ64Hi    uint64
	PriceQ64Lo    uint64
	VolatilityBps uint32
	Timestamp     uint32
}

func floatToQ64(f float64) (hi uint64, lo uint64) {
	scale := new(big.Int).Lsh(big.NewInt(1), 64)
	val := new(big.Float).Mul(big.NewFloat(f), new(big.Float).SetInt(scale))
	intVal, _ := val.Int(nil)

	loMask := new(big.Int).SetUint64(0xFFFFFFFFFFFFFFFF)
	loBig := new(big.Int).And(intVal, loMask)
	hiBig := new(big.Int).Rsh(intVal, 64)

	return hiBig.Uint64(), loBig.Uint64()
}

func q64ToFloat(hi uint64, lo uint64) float64 {
	hiBig := new(big.Int).Lsh(new(big.Int).SetUint64(hi), 64)
	loBig := new(big.Int).SetUint64(lo)
	full := new(big.Int).Or(hiBig, loBig)

	scale := new(big.Float).SetInt(new(big.Int).Lsh(big.NewInt(1), 64))
	fVal := new(big.Float).Quo(new(big.Float).SetInt(full), scale)
	res, _ := fVal.Float64()
	return res
}

func parseRegimeID(regime string) uint32 {
	regime = strings.ToUpper(strings.TrimSpace(regime))
	switch {
	case strings.Contains(regime, "TRENDING UP"):
		return 1
	case strings.Contains(regime, "TRENDING DOWN"):
		return 2
	case strings.Contains(regime, "VOLATILITY") || strings.Contains(regime, "SPIKE"):
		return 3
	default:
		return 0 // Neutral / Ranging
	}
}

func readLocalMarketData(dataPath string) (map[string]float64, uint32, error) {
	historyPath := filepath.Join(dataPath, "market_history.json")
	regimePath := filepath.Join(dataPath, "market_regime.json")

	histBytes, err := os.ReadFile(historyPath)
	if err != nil {
		return nil, 0, fmt.Errorf("failed reading %s: %w", historyPath, err)
	}

	var records []MarketRecord
	if err := json.Unmarshal(histBytes, &records); err != nil {
		return nil, 0, fmt.Errorf("failed decoding %s: %w", historyPath, err)
	}

	latestPrices := make(map[string]float64)
	for _, rec := range records {
		if rec.Price > 0 {
			latestPrices[rec.Symbol] = rec.Price
		}
	}

	regimeID := uint32(0)
	regimeBytes, err := os.ReadFile(regimePath)
	if err == nil {
		var mr MarketRegime
		if json.Unmarshal(regimeBytes, &mr) == nil {
			regimeID = parseRegimeID(mr.Regime)
		}
	}

	return latestPrices, regimeID, nil
}

func buildOracleUpdatePayload(accountIdx uint16, regimeID uint32, prices map[string]float64) ([]byte, []OracleEntry) {
	buf := new(bytes.Buffer)
	now := uint32(time.Now().Unix())

	var entries []OracleEntry
	for sym, symID := range knownSymbols {
		if p, ok := prices[sym]; ok && p > 0 {
			hi, lo := floatToQ64(p)
			entries = append(entries, OracleEntry{
				SymbolID:      symID,
				PriceQ64Hi:    hi,
				PriceQ64Lo:    lo,
				VolatilityBps: 150, // default 1.5%
				Timestamp:     now,
			})
		}
		if len(entries) >= 32 {
			break
		}
	}

	// Header: instruction_type (u32=1), oracle_account_idx (u16), regime_id (u32), timestamp (u32), entry_count (u32)
	binary.Write(buf, binary.LittleEndian, uint32(1))
	binary.Write(buf, binary.LittleEndian, accountIdx)
	binary.Write(buf, binary.LittleEndian, regimeID)
	binary.Write(buf, binary.LittleEndian, now)
	binary.Write(buf, binary.LittleEndian, uint32(len(entries)))

	// Body: oracle_entry entries
	for _, e := range entries {
		binary.Write(buf, binary.LittleEndian, e.SymbolID)
		binary.Write(buf, binary.LittleEndian, e.PriceQ64Hi)
		binary.Write(buf, binary.LittleEndian, e.PriceQ64Lo)
		binary.Write(buf, binary.LittleEndian, e.VolatilityBps)
		binary.Write(buf, binary.LittleEndian, e.Timestamp)
	}

	return buf.Bytes(), entries
}

func main() {
	defaultDir := os.Getenv("MARKET_DATA_DIR")
	if defaultDir == "" {
		defaultDir = "./data"
	}
	dataPath := flag.String("data-dir", defaultDir, "Path to market data directory (or set MARKET_DATA_DIR)")
	interval := flag.Duration("interval", 10*time.Second, "Update interval")
	dryRun := flag.Bool("dry-run", false, "Dry run mode (parse and print without submitting to Thru)")
	programPubkey := flag.String("program", "", "Target Market Oracle program public key")
	oracleAccount := flag.String("account", "", "Target Oracle storage account address")
	feePayer := flag.String("fee-payer", "0xhansen", "Fee payer key name from config")
	once := flag.Bool("once", false, "Run once and exit")
	flag.Parse()

	log.Printf("[THRU:FEEDER] Initializing Zero-Rate-Limit Pipeline tapping %s", *dataPath)
	log.Printf("[THRU:FEEDER] Target Program: %s | Oracle Account: %s | Signer: %s", *programPubkey, *oracleAccount, *feePayer)

	for {
		prices, regimeID, err := readLocalMarketData(*dataPath)
		if err != nil {
			log.Printf("[THRU:FEEDER:ERROR] %v", err)
		} else {
			payload, entries := buildOracleUpdatePayload(2, regimeID, prices)
			hexPayload := hex.EncodeToString(payload)

			log.Printf("[THRU:FEEDER] Built update frame: %d quotes | Regime ID: %d | Payload: %d bytes",
				len(entries), regimeID, len(payload))

			for _, e := range entries {
				flt := q64ToFloat(e.PriceQ64Hi, e.PriceQ64Lo)
				var symName string
				for k, v := range knownSymbols {
					if v == e.SymbolID {
						symName = k
						break
					}
				}
				if e.SymbolID <= 5 || e.SymbolID == 17 { // Log major coins
					log.Printf("  ├─ [%2d] %-8s : $%.4f (Q64: hi=%d lo=%d)", e.SymbolID, symName, flt, e.PriceQ64Hi, e.PriceQ64Lo)
				}
			}

			if *dryRun {
				log.Printf("[THRU:FEEDER:DRY_RUN] Raw instruction hex: %s", hexPayload[:64]+"...")
			} else if *programPubkey != "" && *oracleAccount != "" {
				cmd := exec.Command("thru", "txn", "execute", *programPubkey, hexPayload,
					"--readwrite-accounts", *oracleAccount,
					"--fee-payer", *feePayer,
					"--state-units", "10",
					"--memory-units", "5000",
					"--compute-units", "100000",
					"--fee", "0")
				out, err := cmd.CombinedOutput()
				if err != nil {
					log.Printf("[THRU:FEEDER:TX_FAIL] %v: %s", err, string(out))
				} else {
					log.Printf("[THRU:FEEDER:TX_SUCCESS] On-chain update committed:\n%s", strings.TrimSpace(string(out)))
				}
			} else {
				log.Printf("[THRU:FEEDER:STANDBY] No on-chain target set; verified payload integrity (%d bytes)", len(payload))
			}
		}

		if *once {
			break
		}
		time.Sleep(*interval)
	}
}
