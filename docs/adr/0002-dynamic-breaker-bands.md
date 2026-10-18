# ADR 0002: Dynamic Volatility Bands & Per-Symbol Quarantine

- **Status:** Proposed
- **Date:** 2026-10-19
- **Deciders:** Hansen Core Engineering
- **Technical Domains:** Risk Management, Pricing Invariants, Circuit Breakers

---

## 1. Context & Problem Statement

The Market Oracle contract (`src/market_oracle.c`) enforces a circuit breaker to protect downstream consumers against flash crashes, stale oracle manipulation, and malicious feeder injections.

Under the current architecture:
1. **Uniform Static Threshold:** All 28 assets share a uniform hardcoded 500 bps (5.0%) price movement ceiling per update cycle (`MAX_ALLOWED_DEVIATION_BPS = 500`). While this ceiling accommodates volatile mid-caps, it is too loose for Tier 1 macro assets like BTC and ETH, where a 500 bps swing within a single slot represents an anomalous price shock.
2. **Global Cascade Halt:** If a single asset violates the threshold, the contract sets `circuit_breaker_active = 1`. This immediately halts updates for **all other 27 assets**, creating an unwarranted denial-of-service across unaffected liquid markets.
3. **Staleness Trap:** If network congestion delays feeder submission by 120 seconds, genuine cumulative market movement can exceed the threshold. When the feeder resumes, the batch is rejected, deadlocking the oracle in a state that requires manual operator `--rebase`.

---

## 2. Proposed Architecture (Dynamic Bands & Quarantine)

Version 2 introduces **Asset Liquidity Tiering**, **Time-Decaying Volatility Expansion Bands**, and a **Per-Symbol Quarantine Bitmap**.

### 2.1 Asset Liquidity Tiering

Assets are categorized into three risk tiers based on liquidity depth:

| Tier | Classification | Symbols | Base Collar ($\text{BaseBps}$) | Max Cap ($\text{CapBps}$) |
| :---: | :--- | :--- | :---: | :---: |
| **Tier 1** | Deep Liquidity Macro | `BTCUSDT`, `ETHUSDT` | 150 bps (1.5%) | 400 bps (4.0%) |
| **Tier 2** | Major Liquid Altcoins | `SOL`, `BNB`, `XRP`, `SUI`, `APT`, `AVAX` | 250 bps (2.5%) | 600 bps (6.0%) |
| **Tier 3** | High-Beta & Long-Tail | `PEPE`, `BONK`, `WIF`, `FET`, `RENDER`, `KAS` | 400 bps (4.0%) | 1000 bps (10.0%) |

### 2.2 Time-Decaying Volatility Expansion

To resolve the staleness deadlock trap, allowable price deviation expands as a function of elapsed time since the asset's last confirmed on-chain update:

$$\text{EffectiveCollarBps}(\Delta t) = \min\left(\text{BaseBps} + \left\lfloor \lambda \cdot \Delta t \right\rfloor, \; \text{CapBps}\right)$$

Where:
- $\Delta t = t_{\text{current}} - t_{\text{last\_update}}$ (in seconds).
- $\lambda$ is the volatility expansion rate (e.g. $2.0 \text{ bps/sec}$ for Tier 1, $4.0 \text{ bps/sec}$ for Tier 2/3).
- $\text{CapBps}$ is the absolute mathematical ceiling beyond which no automated update is accepted regardless of elapsed time.

### 2.3 Per-Symbol Quarantine Bitmap

Instead of a monolithic global breaker, the oracle header maintains a 32-bit quarantine register:

```c
typedef struct {
    uint32_t version;
    uint8_t  admin_pubkey[32];
    uint8_t  publisher_pubkey[32];
    uint8_t  pending_admin_pubkey[32];
    uint32_t quarantine_bitmap;       /* Bits 0..31 correspond to symbol IDs 1..32 */
    uint32_t global_breaker_tripped;  /* Set only on systemic systemic breakdown */
    uint32_t last_update_ts;
    /* ... */
} oracle_account_data_v2_t;
```

#### Invariant Rules:
1. **Isolated Quarantine:** If symbol $k$ breaches its $\text{EffectiveCollarBps}$, bit $(k - 1)$ is asserted in `quarantine_bitmap`. Symbol $k$'s price baseline is NOT updated. All valid quotes for other symbols in the batch are committed normally.
2. **Systemic Trip Condition:** The contract trips `global_breaker_tripped = 1` ONLY IF:
   - Both Tier 1 assets (`BTC` and `ETH`) breach their collars simultaneously; OR
   - More than 4 distinct assets are quarantined in a single batch.

---

## 3. Algorithmic Pseudocode (On-Chain Evaluation)

```c
for (uint32_t i = 0; i < input_count; i++) {
    uint32_t sym_id = updates[i].symbol_id;
    uint32_t dt = current_ts - last_entry[sym_id].timestamp;
    
    uint32_t base_bps = get_tier_base_bps(sym_id);
    uint32_t cap_bps  = get_tier_cap_bps(sym_id);
    uint32_t rate     = get_tier_expansion_rate(sym_id);
    
    uint32_t allowed_bps = base_bps + (rate * dt);
    if (allowed_bps > cap_bps) {
        allowed_bps = cap_bps;
    }
    
    uint32_t observed_dev_bps = calc_dev_bps(last_entry[sym_id].price, updates[i].price);
    
    if (observed_dev_bps > allowed_bps) {
        // Quarantine individual symbol
        quarantine_bitmap |= (1U << (sym_id - 1));
        quarantined_count++;
    } else {
        // Clear quarantine bit and commit price
        quarantine_bitmap &= ~(1U << (sym_id - 1));
        commit_price(sym_id, updates[i].price, current_ts);
    }
}

if (quarantined_count >= 4 || (is_quarantined(BTC_ID) && is_quarantined(ETH_ID))) {
    state->global_breaker_tripped = 1;
}
```

---

## 4. Consequences

### Benefits
- **Zero Collateral Halts:** A flash crash or fat finger on a long-tail asset isolates solely that asset, allowing high-liquidity lending pools (BTC/ETH/SOL) to operate without disruption.
- **Autonomous Recovery:** Feeder instances can safely recover after standard network latency without operator intervention, reducing on-call paging frequency.

### Trade-offs
- Downstream protocols must check `(quarantine_bitmap & (1 << (symbol_id - 1))) == 0` prior to reading prices. The TypeScript SDK and Go decoder will provide helper methods `IsSymbolQuarantined(sym)`.
