package quorum

import (
	"testing"
	"time"
)

func TestAggregator_ThreeVenuesConsensus(t *testing.T) {
	agg := NewAggregator(DefaultConfig())
	now := time.Now()

	quotes := []VenueQuote{
		{Venue: "binance", Symbol: "BTCUSDT", Price: 83450.0, Timestamp: now},
		{Venue: "coinbase", Symbol: "BTCUSDT", Price: 83460.0, Timestamp: now},
		{Venue: "okx", Symbol: "BTCUSDT", Price: 83455.0, Timestamp: now},
	}

	res := agg.Aggregate("BTCUSDT", quotes, now)

	if res.Status != QuorumStatusConsensus {
		t.Fatalf("expected consensus, got %s", res.Status)
	}
	if res.Price != 83455.0 {
		t.Fatalf("expected median price 83455.0, got %f", res.Price)
	}
	if len(res.Contributing) != 3 {
		t.Fatalf("expected 3 contributing venues, got %d", len(res.Contributing))
	}
	if len(res.Outliers) != 0 {
		t.Fatalf("expected 0 outliers, got %d", len(res.Outliers))
	}
}

func TestAggregator_HighOutlierFiltering(t *testing.T) {
	agg := NewAggregator(DefaultConfig())
	now := time.Now()

	// Binance and OKX agree around 83,450; Coinbase has anomalous +5% spike to 87,622
	quotes := []VenueQuote{
		{Venue: "binance", Symbol: "BTCUSDT", Price: 83450.0, Timestamp: now},
		{Venue: "okx", Symbol: "BTCUSDT", Price: 83460.0, Timestamp: now},
		{Venue: "coinbase", Symbol: "BTCUSDT", Price: 87622.0, Timestamp: now},
	}

	res := agg.Aggregate("BTCUSDT", quotes, now)

	if res.Status != QuorumStatusOutlierFiltered {
		t.Fatalf("expected outlier filtered, got %s", res.Status)
	}
	expectedPrice := (83450.0 + 83460.0) / 2.0
	if res.Price != expectedPrice {
		t.Fatalf("expected filtered price %f, got %f", expectedPrice, res.Price)
	}
	if len(res.Outliers) != 1 || res.Outliers[0] != "coinbase" {
		t.Fatalf("expected coinbase as outlier, got %v", res.Outliers)
	}
	if len(res.Contributing) != 2 {
		t.Fatalf("expected 2 contributing venues, got %d", len(res.Contributing))
	}
}

func TestAggregator_LowOutlierFiltering(t *testing.T) {
	agg := NewAggregator(DefaultConfig())
	now := time.Now()

	// Binance and Coinbase agree around 2,500; OKX has flash dump to 2,300 (-8%)
	quotes := []VenueQuote{
		{Venue: "binance", Symbol: "ETHUSDT", Price: 2500.0, Timestamp: now},
		{Venue: "coinbase", Symbol: "ETHUSDT", Price: 2505.0, Timestamp: now},
		{Venue: "okx", Symbol: "ETHUSDT", Price: 2300.0, Timestamp: now},
	}

	res := agg.Aggregate("ETHUSDT", quotes, now)

	if res.Status != QuorumStatusOutlierFiltered {
		t.Fatalf("expected outlier filtered, got %s", res.Status)
	}
	expectedPrice := (2500.0 + 2505.0) / 2.0
	if res.Price != expectedPrice {
		t.Fatalf("expected filtered price %f, got %f", expectedPrice, res.Price)
	}
	if len(res.Outliers) != 1 || res.Outliers[0] != "okx" {
		t.Fatalf("expected okx as outlier, got %v", res.Outliers)
	}
}

func TestAggregator_TwoVenuesConsensus(t *testing.T) {
	agg := NewAggregator(DefaultConfig())
	now := time.Now()

	// Only 2 venues available (e.g. symbol not listed on Coinbase)
	quotes := []VenueQuote{
		{Venue: "binance", Symbol: "KASUSDT", Price: 0.03836, Timestamp: now},
		{Venue: "okx", Symbol: "KASUSDT", Price: 0.03840, Timestamp: now},
	}

	res := agg.Aggregate("KASUSDT", quotes, now)

	if res.Status != QuorumStatusConsensus {
		t.Fatalf("expected consensus with 2 venues, got %s", res.Status)
	}
	expectedPrice := (0.03836 + 0.03840) / 2.0
	if res.Price != expectedPrice {
		t.Fatalf("expected price %f, got %f", expectedPrice, res.Price)
	}
}

func TestAggregator_TwoVenuesDisagreement(t *testing.T) {
	agg := NewAggregator(DefaultConfig())
	now := time.Now()

	// 2 venues with 3% deviation (> 150 bps)
	quotes := []VenueQuote{
		{Venue: "binance", Symbol: "SOLUSDT", Price: 100.0, Timestamp: now},
		{Venue: "okx", Symbol: "SOLUSDT", Price: 103.5, Timestamp: now},
	}

	res := agg.Aggregate("SOLUSDT", quotes, now)

	if res.Status != QuorumStatusDisagreement {
		t.Fatalf("expected disagreement, got %s", res.Status)
	}
	if res.Price != 0 {
		t.Fatalf("expected zero price on disagreement, got %f", res.Price)
	}
}

func TestAggregator_ThreeVenuesDisagreement(t *testing.T) {
	agg := NewAggregator(DefaultConfig())
	now := time.Now()

	// All 3 venues divergent: 100, 103, 107 (no pair within 150 bps)
	quotes := []VenueQuote{
		{Venue: "binance", Symbol: "SOLUSDT", Price: 100.0, Timestamp: now},
		{Venue: "coinbase", Symbol: "SOLUSDT", Price: 103.0, Timestamp: now},
		{Venue: "okx", Symbol: "SOLUSDT", Price: 107.0, Timestamp: now},
	}

	res := agg.Aggregate("SOLUSDT", quotes, now)

	if res.Status != QuorumStatusDisagreement {
		t.Fatalf("expected disagreement, got %s", res.Status)
	}
	if res.Price != 0 {
		t.Fatalf("expected price 0 on total disagreement, got %f", res.Price)
	}
}

func TestAggregator_InsufficientVenues(t *testing.T) {
	agg := NewAggregator(DefaultConfig())
	now := time.Now()

	// Only 1 venue responds
	quotes := []VenueQuote{
		{Venue: "binance", Symbol: "BTCUSDT", Price: 83450.0, Timestamp: now},
	}

	res := agg.Aggregate("BTCUSDT", quotes, now)

	if res.Status != QuorumStatusInsufficientVenues {
		t.Fatalf("expected insufficient venues, got %s", res.Status)
	}
	if res.Price != 0 {
		t.Fatalf("expected price 0, got %f", res.Price)
	}
}

func TestAggregator_StaleQuoteFiltering(t *testing.T) {
	agg := NewAggregator(DefaultConfig()) // max staleness: 5s
	now := time.Now()

	// 1 fresh quote, 1 quote that is 10s old
	quotes := []VenueQuote{
		{Venue: "binance", Symbol: "BTCUSDT", Price: 83450.0, Timestamp: now},
		{Venue: "okx", Symbol: "BTCUSDT", Price: 83452.0, Timestamp: now.Add(-10 * time.Second)},
	}

	res := agg.Aggregate("BTCUSDT", quotes, now)

	// Since the second quote is stale, only 1 valid quote remains -> insufficient venues!
	if res.Status != QuorumStatusInsufficientVenues {
		t.Fatalf("expected insufficient venues due to stale quote, got %s", res.Status)
	}
}
