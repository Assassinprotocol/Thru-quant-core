package main

import (
	"math"
	"strings"
)

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

func calculateRollingVolatilityBps(prices []float64) uint32 {
	if len(prices) < 10 {
		return 0 // Insufficient sample horizon (< 10 prices)
	}

	var logReturns []float64
	var sum float64
	for i := 1; i < len(prices); i++ {
		if prices[i-1] <= 0 || prices[i] <= 0 {
			continue
		}
		r := math.Log(prices[i] / prices[i-1])
		logReturns = append(logReturns, r)
		sum += r
	}

	n := float64(len(logReturns))
	if n < 9 {
		return 0
	}
	mean := sum / n

	var varianceSum float64
	for _, r := range logReturns {
		diff := r - mean
		varianceSum += diff * diff
	}

	stdDev := math.Sqrt(varianceSum / (n - 1))
	bps := stdDev * 10000.0
	if bps > 10000.0 {
		bps = 10000.0
	}
	return uint32(bps)
}
