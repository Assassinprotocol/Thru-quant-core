#!/usr/bin/env python3
import unittest
from decimal import Decimal

def compute_v1_price(quotes):
    valid = [Decimal(q) for q in quotes if Decimal(q) > 0]
    if not valid:
        return Decimal(0)
    return sum(valid) // Decimal(len(valid))

def compute_v2_price(quotes, min_quorum=3, outlier_bps=100):
    if len(quotes) < min_quorum:
        return Decimal(0)
    p = sorted([Decimal(q) for q in quotes])
    n = len(p)
    m1 = p[n // 2] if n % 2 == 1 else (p[(n // 2) - 1] + p[n // 2]) // Decimal(2)
    filtered = [x for x in p if (abs(x - m1) * Decimal(10000)) // m1 <= Decimal(outlier_bps)]
    if len(filtered) < min_quorum:
        return Decimal(0)
    m2 = filtered[len(filtered) // 2] if len(filtered) % 2 == 1 else (filtered[(len(filtered) // 2) - 1] + filtered[len(filtered) // 2]) // Decimal(2)
    return m2

class TestV1V2ShadowParity(unittest.TestCase):
    def test_normal_market_parity(self):
        scenarios = [
            ("btc_tight", [8400000000000, 8400500000000, 8401000000000, 8401200000000, 8401500000000]),
            ("eth_liquid", [260000000000, 260050000000, 260100000000, 260120000000, 260200000000]),
            ("sol_active", [10500000000, 10502000000, 10505000000, 10508000000, 10510000000])
        ]

        for name, quotes in scenarios:
            p1 = compute_v1_price(quotes)
            p2 = compute_v2_price(quotes)
            self.assertGreater(p1, 0)
            self.assertGreater(p2, 0)
            delta = abs(p2 - p1)
            bps_diff = (delta * Decimal(10000)) // p1
            self.assertLessEqual(bps_diff, Decimal(15), f"{name}: diff {bps_diff} bps exceeds 15 bps bound")

    def test_outlier_resilience(self):
        base_quotes = [8400000000000, 8400500000000, 8401000000000, 8401500000000]
        spiked_quotes = base_quotes + [8652000000000]

        p2_clean = compute_v2_price(base_quotes)
        p2_spiked = compute_v2_price(spiked_quotes)

        self.assertEqual(p2_clean, p2_spiked)

if __name__ == "__main__":
    unittest.main()
