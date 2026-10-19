package quorum

import (
	"math"
	"sort"
	"time"
)

// Config defines the parameters for the multi-venue quorum consensus engine.
type Config struct {
	MaxStaleness    time.Duration // Maximum allowed age of a venue quote (e.g. 5s)
	MaxDeviationBps int           // Maximum allowable basis point deviation (e.g. 150 bps = 1.5%)
	MinVenues       int           // Minimum independent venues required for consensus (default: 2)
}

// DefaultConfig returns standard defaults (5s staleness, 150 bps collar, 2-venue quorum).
func DefaultConfig() Config {
	return Config{
		MaxStaleness:    5 * time.Second,
		MaxDeviationBps: 150,
		MinVenues:       2,
	}
}

// Aggregator evaluates multi-venue price feeds and enforces consensus invariants.
type Aggregator struct {
	cfg Config
}

// NewAggregator creates an Aggregator with the specified configuration.
func NewAggregator(cfg Config) *Aggregator {
	if cfg.MinVenues < 2 {
		cfg.MinVenues = 2
	}
	if cfg.MaxDeviationBps <= 0 {
		cfg.MaxDeviationBps = 150
	}
	if cfg.MaxStaleness <= 0 {
		cfg.MaxStaleness = 5 * time.Second
	}
	return &Aggregator{cfg: cfg}
}

// calcDeviationBps returns |a - b| / min(a, b) in basis points (10000 = 100%).
func calcDeviationBps(a, b float64) int {
	minVal := math.Min(a, b)
	if minVal <= 0 {
		return 100000
	}
	return int(math.Round((math.Abs(a-b) / minVal) * 10000))
}

// Aggregate performs median quorum consensus and outlier rejection on incoming quotes.
func (a *Aggregator) Aggregate(symbol string, rawQuotes []VenueQuote, now time.Time) QuorumResult {
	res := QuorumResult{
		Symbol:       symbol,
		SourceQuotes: make(map[string]VenueQuote),
	}

	// Filter stale or invalid quotes
	var fresh []VenueQuote
	var maxTs uint32

	for _, q := range rawQuotes {
		if q.Price <= 0 || q.Timestamp.IsZero() {
			continue
		}
		res.SourceQuotes[q.Venue] = q

		age := now.Sub(q.Timestamp)
		if age < 0 {
			age = 0
		}
		if age > a.cfg.MaxStaleness {
			continue
		}

		unixTs := uint32(q.Timestamp.Unix())
		if unixTs > maxTs {
			maxTs = unixTs
		}
		fresh = append(fresh, q)
	}

	res.Timestamp = maxTs

	if len(fresh) < a.cfg.MinVenues {
		res.Status = QuorumStatusInsufficientVenues
		return res
	}

	// Sort ascending by price
	sort.Slice(fresh, func(i, j int) bool {
		return fresh[i].Price < fresh[j].Price
	})

	// Two venues
	if len(fresh) == 2 {
		devBps := calcDeviationBps(fresh[0].Price, fresh[1].Price)
		res.MaxDeviationBps = devBps

		if devBps <= a.cfg.MaxDeviationBps {
			res.Status = QuorumStatusConsensus
			res.Price = (fresh[0].Price + fresh[1].Price) / 2.0
			res.Contributing = []string{fresh[0].Venue, fresh[1].Venue}
			return res
		}

		res.Status = QuorumStatusDisagreement
		return res
	}

	// Three venues
	if len(fresh) == 3 {
		p0 := fresh[0].Price
		p1 := fresh[1].Price
		p2 := fresh[2].Price

		d01 := calcDeviationBps(p0, p1)
		d12 := calcDeviationBps(p1, p2)
		d02 := calcDeviationBps(p0, p2)

		if d02 <= a.cfg.MaxDeviationBps {
			res.Status = QuorumStatusConsensus
			res.Price = p1 // Median
			res.MaxDeviationBps = d02
			res.Contributing = []string{fresh[0].Venue, fresh[1].Venue, fresh[2].Venue}
			return res
		}

		if d01 <= a.cfg.MaxDeviationBps {
			res.Status = QuorumStatusOutlierFiltered
			res.Price = (p0 + p1) / 2.0
			res.MaxDeviationBps = d01
			res.Contributing = []string{fresh[0].Venue, fresh[1].Venue}
			res.Outliers = []string{fresh[2].Venue}
			return res
		}

		if d12 <= a.cfg.MaxDeviationBps {
			res.Status = QuorumStatusOutlierFiltered
			res.Price = (p1 + p2) / 2.0
			res.MaxDeviationBps = d12
			res.Contributing = []string{fresh[1].Venue, fresh[2].Venue}
			res.Outliers = []string{fresh[0].Venue}
			return res
		}

		res.Status = QuorumStatusDisagreement
		res.MaxDeviationBps = int(math.Max(float64(d01), float64(d12)))
		return res
	}

	// Four or more venues: generalized consensus and outlier filtering
	n := len(fresh)
	dAll := calcDeviationBps(fresh[0].Price, fresh[n-1].Price)
	if dAll <= a.cfg.MaxDeviationBps {
		res.Status = QuorumStatusConsensus
		if n%2 == 1 {
			res.Price = fresh[n/2].Price
		} else {
			res.Price = (fresh[n/2-1].Price + fresh[n/2].Price) / 2.0
		}
		res.MaxDeviationBps = dAll
		for _, q := range fresh {
			res.Contributing = append(res.Contributing, q.Venue)
		}
		return res
	}

	// Check single outlier filtering (lowest fresh[0] or highest fresh[n-1])
	dDropLow := calcDeviationBps(fresh[1].Price, fresh[n-1].Price)
	dDropHigh := calcDeviationBps(fresh[0].Price, fresh[n-2].Price)

	if dDropLow <= a.cfg.MaxDeviationBps && (dDropHigh > a.cfg.MaxDeviationBps || dDropLow < dDropHigh) {
		res.Status = QuorumStatusOutlierFiltered
		sub := fresh[1:]
		subN := len(sub)
		if subN%2 == 1 {
			res.Price = sub[subN/2].Price
		} else {
			res.Price = (sub[subN/2-1].Price + sub[subN/2].Price) / 2.0
		}
		res.MaxDeviationBps = dDropLow
		for _, q := range sub {
			res.Contributing = append(res.Contributing, q.Venue)
		}
		res.Outliers = []string{fresh[0].Venue}
		return res
	}

	if dDropHigh <= a.cfg.MaxDeviationBps {
		res.Status = QuorumStatusOutlierFiltered
		sub := fresh[:n-1]
		subN := len(sub)
		if subN%2 == 1 {
			res.Price = sub[subN/2].Price
		} else {
			res.Price = (sub[subN/2-1].Price + sub[subN/2].Price) / 2.0
		}
		res.MaxDeviationBps = dDropHigh
		for _, q := range sub {
			res.Contributing = append(res.Contributing, q.Venue)
		}
		res.Outliers = []string{fresh[n-1].Venue}
		return res
	}

	res.Status = QuorumStatusDisagreement
	res.MaxDeviationBps = dAll
	return res
}
