package main

import (
	"bufio"
	"context"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"

	"thru_quant_core/feeder/quorum"
)

func readLocalMarketData(dataPath string) (map[string]QuoteData, uint32, error) {
	historyPath := filepath.Join(dataPath, "market_history.json")

	histBytes, err := os.ReadFile(historyPath)
	if err != nil {
		return nil, 0, fmt.Errorf("failed reading %s: %w", historyPath, err)
	}

	var records []MarketRecord
	if err := json.Unmarshal(histBytes, &records); err != nil {
		return nil, 0, fmt.Errorf("failed decoding %s: %w", historyPath, err)
	}

	// Group records by symbol and track maximum timestamp
	symbolHistory := make(map[string][]float64)
	latestRecords := make(map[string]MarketRecord)

	for _, rec := range records {
		if rec.Price <= 0 {
			continue
		}
		symbolHistory[rec.Symbol] = append(symbolHistory[rec.Symbol], rec.Price)
		existing, ok := latestRecords[rec.Symbol]
		if !ok || rec.Timestamp > existing.Timestamp {
			latestRecords[rec.Symbol] = rec
		}
	}

	nowSec := float64(time.Now().Unix())
	maxStaleAge := 120.0 // Reject quotes older than 120 seconds

	resultQuotes := make(map[string]QuoteData)
	for sym, rec := range latestRecords {
		if rec.Timestamp > 0 && (nowSec-rec.Timestamp) > maxStaleAge {
			log.Printf("feeder: quote %s is stale (%.1fs > %.0fs), skipping", sym, nowSec-rec.Timestamp, maxStaleAge)
			continue
		}

		sourceTs := uint32(rec.Timestamp)
		if sourceTs == 0 {
			log.Printf("feeder: quote %s missing timestamp, dropping", sym)
			continue
		}

		volBps := calculateRollingVolatilityBps(symbolHistory[sym])
		resultQuotes[sym] = QuoteData{
			Price:         rec.Price,
			SourceTime:    sourceTs,
			VolatilityBps: volBps,
		}
	}

	regimeID := readRegimeID(dataPath)
	return resultQuotes, regimeID, nil
}

func readRegimeID(dataPath string) uint32 {
	regimePath := filepath.Join(dataPath, "market_regime.json")
	regimeBytes, err := os.ReadFile(regimePath)
	if err == nil {
		var mr MarketRegime
		if json.Unmarshal(regimeBytes, &mr) == nil {
			return parseRegimeID(mr.Regime)
		}
	}
	return 0
}

func confirmOperatorAction(prompt string) bool {
	fmt.Printf("%s [y/N]: ", prompt)
	reader := bufio.NewReader(os.Stdin)
	response, err := reader.ReadString('\n')
	if err != nil {
		return false
	}
	response = strings.ToLower(strings.TrimSpace(response))
	return response == "y" || response == "yes"
}

func main() {
	defaultDir := os.Getenv("MARKET_DATA_DIR")
	if defaultDir == "" {
		defaultDir = "./data"
	}
	dataPath := flag.String("data-dir", defaultDir, "Path to market data directory (or set MARKET_DATA_DIR)")
	interval := flag.Duration("interval", 10*time.Second, "Update interval")
	dryRun := flag.Bool("dry-run", false, "Dry run mode (parse and print without submitting to Thru)")
	resumeMode := flag.Bool("resume", false, "Submit authorized resume instruction to reset circuit breaker (ORACLE_INSTR_RESUME)")
	rebaseMode := flag.Bool("rebase", false, "Submit authorized rebase instruction to reset circuit breaker with new baseline (ORACLE_INSTR_REBASE)")
	autoConfirm := flag.Bool("yes", false, "Automatically confirm operator prompt without interactive prompt")
	flag.BoolVar(autoConfirm, "y", false, "Alias for --yes")
	auditLogPath := flag.String("audit-log", "feeder_audit.log", "Path to append-only operator audit log")
	accountIdx := flag.Uint("account-idx", 2, "Oracle account index in txn accounts array")
	programPubkey := flag.String("program", "", "Target Market Oracle program public key")
	oracleAccount := flag.String("account", "", "Target Oracle storage account address")
	feePayer := flag.String("fee-payer", "0xhansen", "Fee payer key name from config")
	network := flag.String("network", "betanet", "Target Thru network profile")
	once := flag.Bool("once", false, "Run once and exit")
	mode := flag.String("mode", "local", "Feeder mode: 'local' (read disk files) or 'quorum' (ingest from multi-venue API sources)")
	venues := flag.String("venues", "binance,coinbase,okx", "Comma-separated list of venue sources for quorum mode")
	quorumCollarBps := flag.Int("quorum-collar-bps", 150, "Maximum basis point deviation allowable between venues for consensus")
	quorumTimeout := flag.Duration("quorum-timeout", 2*time.Second, "Timeout per venue HTTP request")
	v2Program := flag.String("v2-program", "", "Target Oracle v2 program public key for dual-stack streaming")
	v2SubAccount := flag.String("v2-submission-account", "", "Target Oracle v2 publisher submission account")
	flag.Parse()

	if *programPubkey == "" || *oracleAccount == "" {
		if depBytes, err := os.ReadFile("deploy/deployed.json"); err == nil {
			var depData struct {
				Deployments map[string]struct {
					ProgramID      *string `json:"program_id"`
					StateAccountID *string `json:"state_account_id"`
				} `json:"deployments"`
			}
			if json.Unmarshal(depBytes, &depData) == nil {
				if d, ok := depData.Deployments[*network]; ok {
					if *programPubkey == "" && d.ProgramID != nil {
						*programPubkey = *d.ProgramID
					}
					if *oracleAccount == "" && d.StateAccountID != nil {
						*oracleAccount = *d.StateAccountID
					}
				}
			}
		}
	}

	var quorumSources []quorum.VenueSource
	var quorumAgg *quorum.Aggregator
	var targetSymbols []string
	priceHistory := make(map[string][]float64)

	if *mode == "quorum" {
		var err error
		quorumSources, err = initVenueSources(*venues, *quorumTimeout)
		if err != nil {
			log.Fatalf("feeder: failed initializing venue sources: %v", err)
		}
		aggCfg := quorum.DefaultConfig()
		aggCfg.MaxDeviationBps = *quorumCollarBps
		quorumAgg = quorum.NewAggregator(aggCfg)

		for sym := range knownSymbols {
			targetSymbols = append(targetSymbols, sym)
		}
		sort.Strings(targetSymbols)
		log.Printf("feeder: mode=QUORUM venues=%s collar=%dbps tracking=%d symbols",
			*venues, *quorumCollarBps, len(targetSymbols))
	} else {
		log.Printf("feeder: mode=LOCAL data_dir=%s", *dataPath)
	}

	if *resumeMode {
		log.Printf("feeder: executing resume (opcode 2)")
		log.Printf("feeder: program=%s account=%s fee_payer=%s", *programPubkey, *oracleAccount, *feePayer)

		payload := buildOracleResumePayload(uint16(*accountIdx))
		hexPayload := hex.EncodeToString(payload)
		log.Printf("feeder: resume payload (%d B): %s", len(payload), hexPayload)

		if *dryRun {
			log.Printf("feeder: dry-run, skipping on-chain resume")
			return
		}

		if *programPubkey == "" || *oracleAccount == "" {
			log.Fatalf("feeder: --program and --account required to execute resume")
		}

		if !*autoConfirm {
			if !confirmOperatorAction("Confirm on-chain RESUME execution?") {
				log.Println("feeder: aborted by operator")
				return
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, "thru", "--network", *network, "txn", "execute", *programPubkey, hexPayload,
			"--readwrite-accounts", *oracleAccount,
			"--fee-payer", *feePayer,
			"--state-units", "10",
			"--memory-units", "5000",
			"--compute-units", "100000",
			"--fee", "0")
		out, err := cmd.CombinedOutput()
		status := "SUCCESS"
		if err != nil {
			status = "FAILED"
		}
		_ = recordOperatorAudit(*auditLogPath, "RESUME", *feePayer, *programPubkey, *oracleAccount, hexPayload, status, string(out))

		if err != nil {
			log.Fatalf("feeder: resume failed: %v: %s", err, string(out))
		}
		log.Printf("feeder: resume confirmed on-chain:\n%s", strings.TrimSpace(string(out)))
		return
	}

	if *rebaseMode {
		log.Printf("feeder: executing rebase (opcode 3)")
		log.Printf("feeder: program=%s account=%s fee_payer=%s", *programPubkey, *oracleAccount, *feePayer)

		var prices map[string]QuoteData
		var regimeID uint32
		if *mode == "quorum" {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			var err error
			prices, _, err = fetchQuorumMarketData(ctx, quorumSources, quorumAgg, targetSymbols, priceHistory)
			cancel()
			if err != nil {
				log.Fatalf("feeder: failed fetching quorum market data: %v", err)
			}
			regimeID = readRegimeID(*dataPath)
		} else {
			var err error
			prices, regimeID, err = readLocalMarketData(*dataPath)
			if err != nil {
				log.Fatalf("feeder: failed reading market data: %v", err)
			}
		}

		payload, entries := buildOracleRebasePayload(uint16(*accountIdx), regimeID, prices, nil)
		if len(entries) == 0 {
			log.Fatalf("feeder: no valid quotes available for rebase")
		}

		hexPayload := hex.EncodeToString(payload)
		log.Printf("feeder: rebase payload (%d bytes, %d quotes)", len(payload), len(entries))

		for _, e := range entries {
			flt := q64ToFloat(e.PriceQ64Hi, e.PriceQ64Lo)
			var symName string
			for k, v := range knownSymbols {
				if v == e.SymbolID {
					symName = k
					break
				}
			}
			log.Printf("  baseline %-8s : $%.4f (vol: %d bps)", symName, flt, e.VolatilityBps)
		}

		if *dryRun {
			log.Printf("feeder: dry-run, skipping on-chain rebase")
			return
		}

		if *programPubkey == "" || *oracleAccount == "" {
			log.Fatalf("feeder: --program and --account required to execute rebase")
		}

		if !*autoConfirm {
			if !confirmOperatorAction("Confirm on-chain REBASE execution with above baselines?") {
				log.Println("feeder: aborted by operator")
				return
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, "thru", "txn", "execute", *programPubkey, hexPayload,
			"--readwrite-accounts", *oracleAccount,
			"--fee-payer", *feePayer,
			"--state-units", "10",
			"--memory-units", "5000",
			"--compute-units", "100000",
			"--fee", "0")
		out, err := cmd.CombinedOutput()
		status := "SUCCESS"
		if err != nil {
			status = "FAILED"
		}
		_ = recordOperatorAudit(*auditLogPath, "REBASE", *feePayer, *programPubkey, *oracleAccount, hexPayload, status, string(out))

		if err != nil {
			log.Fatalf("feeder: rebase failed: %v: %s", err, string(out))
		}
		log.Printf("feeder: rebase confirmed on-chain:\n%s", strings.TrimSpace(string(out)))
		return
	}

	log.Printf("feeder: reading market data from %s", *dataPath)
	log.Printf("feeder: program=%s account=%s fee_payer=%s", *programPubkey, *oracleAccount, *feePayer)

	// Graceful shutdown on SIGINT/SIGTERM
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("feeder: shutting down")
		os.Exit(0)
	}()

	sequenceNum := uint64(0)
	lastPublishedTs := make(map[uint32]uint32)
	feederState := StateRunning

	for {
		sequenceNum++

		if feederState == StateHold {
			log.Printf("feeder: in HOLD state (seq=%d), waiting for operator --rebase or --resume", sequenceNum)
			if *once {
				break
			}
			time.Sleep(*interval)
			continue
		}

		var prices map[string]QuoteData
		var regimeID uint32
		var err error
		if *mode == "quorum" {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			prices, _, err = fetchQuorumMarketData(ctx, quorumSources, quorumAgg, targetSymbols, priceHistory)
			cancel()
			regimeID = readRegimeID(*dataPath)
		} else {
			prices, regimeID, err = readLocalMarketData(*dataPath)
		}
		if err != nil {
			log.Printf("feeder: seq=%d read error: %v", sequenceNum, err)
		} else {
			payload, entries := buildOracleUpdatePayload(uint16(*accountIdx), regimeID, prices, lastPublishedTs)
			if len(entries) == 0 {
				log.Printf("feeder: seq=%d no valid quotes, skipping batch", sequenceNum)
			} else {
				hexPayload := hex.EncodeToString(payload)

				log.Printf("feeder: seq=%d quotes=%d regime=%d payload_bytes=%d",
					sequenceNum, len(entries), regimeID, len(payload))

				for _, e := range entries {
					flt := q64ToFloat(e.PriceQ64Hi, e.PriceQ64Lo)
					var symName string
					for k, v := range knownSymbols {
						if v == e.SymbolID {
							symName = k
							break
						}
					}
					if e.SymbolID <= 5 || e.SymbolID == 17 {
						log.Printf("  [%2d] %-8s : $%.4f", e.SymbolID, symName, flt)
					}
				}

				if *dryRun {
					log.Printf("feeder: dry-run hex: %s...", hexPayload[:min(64, len(hexPayload))])
				} else if *programPubkey != "" && *oracleAccount != "" {
					ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
					cmd := exec.CommandContext(ctx, "thru", "--network", *network, "txn", "execute", *programPubkey, hexPayload,
						"--readwrite-accounts", *oracleAccount,
						"--fee-payer", *feePayer,
						"--state-units", "10",
						"--memory-units", "5000",
						"--compute-units", "100000",
						"--fee", "0")
					out, err := cmd.CombinedOutput()
					cancel()

					resultType := ClassifyTxOutput(string(out), err)
					switch resultType {
					case TxResultSuccess:
						log.Printf("feeder: tx confirmed:\n%s", strings.TrimSpace(string(out)))
					case TxResultTripped:
						feederState = StateHold
						log.Printf("feeder: circuit breaker tripped on-chain: %s", strings.TrimSpace(string(out)))
						log.Printf("feeder: state changed RUNNING -> HOLD, updates paused")
						_ = recordOperatorAudit(*auditLogPath, "TRIPPED_HOLD", *feePayer, *programPubkey, *oracleAccount, hexPayload, "HOLD", string(out))
					default:
						log.Printf("feeder: tx failed (%s): %v: %s", resultType, err, string(out))
					}
				} else {
					log.Printf("feeder: verified payload (%d bytes), no on-chain target set", len(payload))
				}

				if *v2Program != "" || *v2SubAccount != "" || *dryRun {
					v2Payload := BuildV2SubmitPayload(0, 1, sequenceNum, prices)
					if len(v2Payload) > 0 {
						log.Printf("feeder: v2 payload_bytes=%d", len(v2Payload))
						if !*dryRun && *v2Program != "" && *v2SubAccount != "" {
							v2Ctx, v2Cancel := context.WithTimeout(context.Background(), 15*time.Second)
							v2Cmd := exec.CommandContext(v2Ctx, "thru", "--network", *network, "txn", "execute", *v2Program, hex.EncodeToString(v2Payload),
								"--readwrite-accounts", *v2SubAccount,
								"--fee-payer", *feePayer,
								"--state-units", "10",
								"--memory-units", "5000",
								"--compute-units", "100000",
								"--fee", "0")
							v2Out, v2Err := v2Cmd.CombinedOutput()
							v2Cancel()
							if v2Err == nil {
								log.Printf("feeder: v2 tx confirmed:\n%s", strings.TrimSpace(string(v2Out)))
							} else {
								log.Printf("feeder: v2 tx failed: %v: %s", v2Err, string(v2Out))
							}
						}
					}
				}
			}
		}

		if *once {
			break
		}
		time.Sleep(*interval)
	}
}
