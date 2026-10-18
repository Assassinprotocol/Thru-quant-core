package quorum

import (
	"context"
	"time"
)

// VenueQuote represents a single price observation from an exchange venue.
type VenueQuote struct {
	Venue     string    `json:"venue"`
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Timestamp time.Time `json:"timestamp"`
}

// QuorumStatus indicates the outcome of a multi-venue consensus calculation.
type QuorumStatus int

const (
	QuorumStatusConsensus QuorumStatus = iota
	QuorumStatusOutlierFiltered
	QuorumStatusDisagreement
	QuorumStatusInsufficientVenues
)

func (s QuorumStatus) String() string {
	switch s {
	case QuorumStatusConsensus:
		return "CONSENSUS"
	case QuorumStatusOutlierFiltered:
		return "OUTLIER_FILTERED"
	case QuorumStatusDisagreement:
		return "DISAGREEMENT"
	case QuorumStatusInsufficientVenues:
		return "INSUFFICIENT_VENUES"
	default:
		return "UNKNOWN"
	}
}

// QuorumResult encapsulates the aggregated price and metadata for a symbol.
type QuorumResult struct {
	Symbol          string                `json:"symbol"`
	Price           float64               `json:"price"`
	Status          QuorumStatus          `json:"status"`
	Contributing    []string              `json:"contributing_venues"`
	Outliers        []string              `json:"outlier_venues"`
	MaxDeviationBps int                   `json:"max_deviation_bps"`
	SourceQuotes    map[string]VenueQuote `json:"source_quotes"`
	Timestamp       uint32                `json:"timestamp"`
}

// VenueSource defines the contract for an exchange price source adapter.
type VenueSource interface {
	Name() string
	FetchQuotes(ctx context.Context, symbols []string) (map[string]VenueQuote, error)
}
