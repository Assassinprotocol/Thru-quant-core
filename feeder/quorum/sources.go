package quorum

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// MockVenueSource provides an in-memory venue source for deterministic testing.
type MockVenueSource struct {
	VenueName string
	Quotes    map[string]VenueQuote
	Err       error
}

func NewMockVenueSource(name string) *MockVenueSource {
	return &MockVenueSource{
		VenueName: name,
		Quotes:    make(map[string]VenueQuote),
	}
}

func (m *MockVenueSource) Name() string {
	return m.VenueName
}

func (m *MockVenueSource) SetQuote(symbol string, price float64, ts time.Time) {
	m.Quotes[symbol] = VenueQuote{
		Venue:     m.VenueName,
		Symbol:    symbol,
		Price:     price,
		Timestamp: ts,
	}
}

func (m *MockVenueSource) SetError(err error) {
	m.Err = err
}

func (m *MockVenueSource) FetchQuotes(ctx context.Context, symbols []string) (map[string]VenueQuote, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	res := make(map[string]VenueQuote)
	for _, sym := range symbols {
		if q, ok := m.Quotes[sym]; ok {
			res[sym] = q
		}
	}
	return res, nil
}

// BinanceSource fetches spot market prices from the Binance public REST API.
type BinanceSource struct {
	client  *http.Client
	baseURL string
}

func NewBinanceSource(timeout time.Duration) *BinanceSource {
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	return &BinanceSource{
		client:  &http.Client{Timeout: timeout},
		baseURL: "https://api.binance.com",
	}
}

func (b *BinanceSource) Name() string {
	return "binance"
}

type binanceTicker struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
}

func (b *BinanceSource) FetchQuotes(ctx context.Context, symbols []string) (map[string]VenueQuote, error) {
	url := fmt.Sprintf("%s/api/v3/ticker/price", b.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("binance api returned status %d", resp.StatusCode)
	}

	var tickers []binanceTicker
	if err := json.NewDecoder(resp.Body).Decode(&tickers); err != nil {
		return nil, err
	}

	filter := make(map[string]bool)
	for _, s := range symbols {
		filter[s] = true
	}

	now := time.Now()
	quotes := make(map[string]VenueQuote)
	for _, t := range tickers {
		if filter[t.Symbol] {
			p, err := strconv.ParseFloat(t.Price, 64)
			if err == nil && p > 0 {
				quotes[t.Symbol] = VenueQuote{
					Venue:     b.Name(),
					Symbol:    t.Symbol,
					Price:     p,
					Timestamp: now,
				}
			}
		}
	}

	return quotes, nil
}

// OKXSource fetches spot tickers from the OKX public REST API v5.
type OKXSource struct {
	client  *http.Client
	baseURL string
}

func NewOKXSource(timeout time.Duration) *OKXSource {
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	return &OKXSource{
		client:  &http.Client{Timeout: timeout},
		baseURL: "https://www.okx.com",
	}
}

func (o *OKXSource) Name() string {
	return "okx"
}

type okxTickerResponse struct {
	Code string `json:"code"`
	Data []struct {
		InstID string `json:"instId"`
		Last   string `json:"last"`
		Ts     string `json:"ts"`
	} `json:"data"`
}

func (o *OKXSource) FetchQuotes(ctx context.Context, symbols []string) (map[string]VenueQuote, error) {
	url := fmt.Sprintf("%s/api/v5/market/tickers?instType=SPOT", o.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := o.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("okx api returned status %d", resp.StatusCode)
	}

	var parsed okxTickerResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}

	// OKX uses "BTC-USDT" format; build map to standard symbol "BTCUSDT"
	now := time.Now()
	quotes := make(map[string]VenueQuote)
	for _, item := range parsed.Data {
		stdSym := strings.ReplaceAll(item.InstID, "-", "")
		for _, s := range symbols {
			if stdSym == s {
				p, err := strconv.ParseFloat(item.Last, 64)
				if err == nil && p > 0 {
					quotes[s] = VenueQuote{
						Venue:     o.Name(),
						Symbol:    s,
						Price:     p,
						Timestamp: now,
					}
				}
			}
		}
	}

	return quotes, nil
}

// CoinbaseSource fetches spot ticker quotes from the Coinbase Exchange API.
type CoinbaseSource struct {
	client  *http.Client
	baseURL string
}

func NewCoinbaseSource(timeout time.Duration) *CoinbaseSource {
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	return &CoinbaseSource{
		client:  &http.Client{Timeout: timeout},
		baseURL: "https://api.exchange.coinbase.com",
	}
}

func (c *CoinbaseSource) Name() string {
	return "coinbase"
}

type coinbaseTicker struct {
	Price string `json:"price"`
	Time  string `json:"time"`
}

func (c *CoinbaseSource) FetchQuotes(ctx context.Context, symbols []string) (map[string]VenueQuote, error) {
	quotes := make(map[string]VenueQuote)
	now := time.Now()

	// Ingest primary high-liquidity symbols supported on Coinbase
	for _, sym := range symbols {
		var productID string
		if strings.HasSuffix(sym, "USDT") {
			base := strings.TrimSuffix(sym, "USDT")
			productID = fmt.Sprintf("%s-USDT", base)
		} else {
			continue
		}

		url := fmt.Sprintf("%s/products/%s/ticker", c.baseURL, productID)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			continue
		}

		resp, err := c.client.Do(req)
		if err != nil {
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			continue
		}

		var cb coinbaseTicker
		err = json.NewDecoder(resp.Body).Decode(&cb)
		resp.Body.Close()

		if err == nil {
			p, err := strconv.ParseFloat(cb.Price, 64)
			if err == nil && p > 0 {
				quotes[sym] = VenueQuote{
					Venue:     c.Name(),
					Symbol:    sym,
					Price:     p,
					Timestamp: now,
				}
			}
		}
	}

	return quotes, nil
}
