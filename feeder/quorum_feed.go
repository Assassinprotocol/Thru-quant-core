package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"thru_quant_core/feeder/quorum"
)

// initVenueSources parses a comma-delimited venue list and returns initialized VenueSources.
func initVenueSources(venuesList string, timeout time.Duration) ([]quorum.VenueSource, error) {
	parts := strings.Split(venuesList, ",")
	var sources []quorum.VenueSource

	for _, p := range parts {
		name := strings.TrimSpace(strings.ToLower(p))
		if name == "" {
			continue
		}
		switch name {
		case "binance":
			sources = append(sources, quorum.NewBinanceSource(timeout))
		case "coinbase":
			sources = append(sources, quorum.NewCoinbaseSource(timeout))
		case "okx":
			sources = append(sources, quorum.NewOKXSource(timeout))
		default:
			return nil, fmt.Errorf("unsupported venue source: %s", name)
		}
	}

	if len(sources) == 0 {
		return nil, fmt.Errorf("no valid venues specified in %q", venuesList)
	}

	return sources, nil
}

// fetchQuorumMarketData polls all configured venue sources concurrently, runs median quorum consensus,
// and produces QuoteData entries for symbols that achieve consensus.
func fetchQuorumMarketData(
	ctx context.Context,
	sources []quorum.VenueSource,
	agg *quorum.Aggregator,
	symbols []string,
	priceHistory map[string][]float64,
) (map[string]QuoteData, map[string]quorum.QuorumResult, error) {
	type venueResult struct {
		venue  string
		quotes map[string]quorum.VenueQuote
		err    error
	}

	ch := make(chan venueResult, len(sources))
	var wg sync.WaitGroup

	for _, src := range sources {
		wg.Add(1)
		go func(s quorum.VenueSource) {
			defer wg.Done()
			quotes, err := s.FetchQuotes(ctx, symbols)
			ch <- venueResult{
				venue:  s.Name(),
				quotes: quotes,
				err:    err,
			}
		}(src)
	}

	wg.Wait()
	close(ch)

	// Group quotes by symbol across venues
	quotesBySymbol := make(map[string][]quorum.VenueQuote)
	for res := range ch {
		if res.err != nil {
			log.Printf("feeder: venue %s fetch error: %v", res.venue, res.err)
			continue
		}
		for sym, q := range res.quotes {
			quotesBySymbol[sym] = append(quotesBySymbol[sym], q)
		}
	}

	now := time.Now()
	nowSec := uint32(now.Unix())

	results := make(map[string]quorum.QuorumResult)
	quotes := make(map[string]QuoteData)

	for _, sym := range symbols {
		vQuotes := quotesBySymbol[sym]
		res := agg.Aggregate(sym, vQuotes, now)
		results[sym] = res

		if res.Status == quorum.QuorumStatusConsensus || res.Status == quorum.QuorumStatusOutlierFiltered {
			// Update history window for rolling volatility
			priceHistory[sym] = append(priceHistory[sym], res.Price)
			if len(priceHistory[sym]) > 50 {
				priceHistory[sym] = priceHistory[sym][len(priceHistory[sym])-50:]
			}

			volBps := calculateRollingVolatilityBps(priceHistory[sym])
			sourceTs := res.Timestamp
			if sourceTs == 0 {
				sourceTs = nowSec
			}

			quotes[sym] = QuoteData{
				Price:         res.Price,
				SourceTime:    sourceTs,
				VolatilityBps: volBps,
			}
		} else {
			log.Printf("feeder: quorum dropped symbol %s: status=%s max_dev=%dbps",
				sym, res.Status, res.MaxDeviationBps)
		}
	}

	return quotes, results, nil
}
