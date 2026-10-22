# Oracle v2 Specification

On-chain consensus, storage layouts, wire opcodes, and aggregation engine for Thru Price Hub on Betanet (RV64IMC).

---

## 1. Overview & Core Rules

1. **Responsibility Decoupling:** The oracle commits consensus price, confidence dispersion, and state flags. Downstream consumer programs enforce their own risk and freeze policies.
2. **Deterministic Execution:** No floating-point instructions or memory allocations. All math is checked integer fixed-point (8 decimal places for USD pairs, basis points for spreads and confidence).
3. **Storage Isolation:** Dedicated submission PDAs per publisher avoid write lock contention across parallel ingestion pipelines.

---

## 2. Account Layouts

Structures use explicit 8-byte alignment and fixed padding to ensure deterministic binary representations under `rv64imc-unknown-none-elf`.

### 2.1 Registry Account (`registry_account_data_t`)

Singleton account managing publisher membership, feed configurations, and admin timelock.

```c
#define ORACLE_V2_REGISTRY_MAGIC 0x54524547 /* "TREG" */
#define MAX_PUBLISHERS           7
#define MAX_FEEDS                32
#define TIMELOCK_DELAY_SECONDS   86400      /* 24 hours */

typedef struct {
    uint8_t  pubkey[32];
    uint32_t status;              /* 0: inactive, 1: active, 2: suspended */
    uint32_t weight;              /* reserved, default 1 */
    uint64_t last_submission_slot;
} publisher_desc_t;               /* 48 bytes */

typedef struct {
    uint32_t symbol_id;           /* 1: BTC, 2: ETH, 3: SOL, 4: USDT, 5: USDC, 6: THRU */
    uint32_t status;              /* 0: disabled, 1: active, 2: paused */
    uint32_t outlier_bps;         /* pass-1 tolerance, default 100 bps */
    uint32_t max_staleness_slots; /* max slot age before marked stale */
    uint32_t big_move_bps;        /* large deviation threshold, default 300 bps */
    uint32_t reserved;
} feed_config_t;                  /* 24 bytes */

typedef struct {
    uint32_t action_id;
    uint32_t target_id;
    uint64_t param_val;
    uint64_t unlock_timestamp;
} timelock_entry_t;               /* 24 bytes */

typedef struct {
    uint32_t magic;               /* 0x54524547 */
    uint32_t version;             /* 2 */
    uint32_t admin_m;             /* required multisig threshold */
    uint32_t admin_n;             /* total admin keys (M <= N <= 5) */
    uint8_t  admin_keys[5][32];
    uint8_t  pending_admin_keys[5][32];
    uint32_t pending_admin_m;
    uint32_t pending_admin_n;
    uint64_t admin_transfer_expiry;

    uint32_t min_publishers;      /* consensus quorum threshold, M >= 3 */
    uint32_t publisher_count;
    publisher_desc_t publishers[MAX_PUBLISHERS];

    uint32_t feed_count;
    feed_config_t feeds[MAX_FEEDS];

    uint32_t timelock_count;
    timelock_entry_t timelock_queue[8];
} registry_account_data_t;
```

### 2.2 Submission Account (`submission_account_data_t`)

One account per enrolled publisher. Derived via PDA: `["submission", publisher_pubkey]`.

```c
#define ORACLE_V2_SUBMISSION_MAGIC 0x54535542 /* "TSUB" */

typedef struct {
    uint32_t symbol_id;
    uint32_t reserved;
    uint64_t price;               /* 8 decimal places (e.g. 84000.50 -> 8400050000000) */
    uint64_t source_ts;           /* unix epoch seconds at quote capture */
} raw_quote_t;                    /* 24 bytes */

typedef struct {
    uint32_t magic;               /* 0x54535542 */
    uint32_t version;             /* 2 */
    uint8_t  publisher_pubkey[32];
    uint64_t sequence_number;     /* strictly monotonic counter */
    uint64_t publish_slot;        /* slot recorded at transaction execution */
    uint32_t quote_count;
    uint32_t flags;
    raw_quote_t quotes[MAX_FEEDS];
} submission_account_data_t;
```

### 2.3 Feed Account (`feed_account_data_t`)

One account per asset pair. Derived via PDA: `["feed", symbol_id]`.

```c
#define ORACLE_V2_FEED_MAGIC 0x54464545 /* "TFEE" */

#define FEED_FLAG_STALE             (1U << 0) /* 0x01: update exceeds heartbeat */
#define FEED_FLAG_BIG_MOVE          (1U << 1) /* 0x02: price delta >= big_move_bps */
#define FEED_FLAG_LOW_CONFIDENCE    (1U << 2) /* 0x04: dispersion >= threshold */
#define FEED_FLAG_OUTLIER_REJECTED  (1U << 3) /* 0x08: quote dropped in pass 1 */

typedef struct {
    uint32_t magic;               /* 0x54464545 */
    uint32_t version;             /* 2 */
    uint32_t symbol_id;
    uint32_t status;              /* 1: active, 2: paused */
    uint64_t price;               /* canonical consensus price */
    uint64_t prev_price;
    uint64_t confidence_bps;      /* MAD in basis points */
    uint64_t publish_slot;        /* slot of last aggregation */
    uint64_t prev_publish_slot;
    uint64_t median_source_ts;    /* median of accepted contributor timestamps */
    uint32_t contributor_count;   /* count of contributing publishers */
    uint32_t flags;               /* bitmask of FEED_FLAG_* */
    uint8_t  contributor_mask;    /* bitmask of contributing publisher indices */
    uint8_t  reserved[7];
} feed_account_data_t;
```

---

## 3. Instruction Set Architecture

| Opcode | Instruction | Signer | Purpose |
|:---:|---|---|---|
| `0x0001` | `INITIALIZE_REGISTRY` | Deployer / Admin Keys | Initialize registry with initial M-of-N parameters. |
| `0x0002` | `SUBMIT_PRICES` | Registered Publisher | Write latest batch of quotes to publisher's submission account. |
| `0x0003` | `AGGREGATE` | Any (Permissionless) | Execute two-pass median aggregation and update feed account. |
| `0x0004` | `QUEUE_CONFIG` | Admin M-of-N | Queue configuration change into 24-hour timelock. |
| `0x0005` | `APPLY_CONFIG` | Any (Permissionless) | Execute matured timelock entry after delay elapses. |
| `0x0006` | `EMERGENCY_PAUSE_SYMBOL`| Admin M-of-N | Immediately pause a feed without timelock. |
| `0x0007` | `EMERGENCY_RESUME_SYMBOL`| Admin M-of-N | Resume a paused feed. |
| `0x0008` | `SET_PUBLISHER` | Admin M-of-N | Add, suspend, or revoke publisher public key. |
| `0x0009` | `PROPOSE_ADMIN` | Admin M-of-N | Step 1 of two-step admin keyset handover. |
| `0x000A` | `ACCEPT_ADMIN` | Pending Admin Set | Step 2 of two-step admin keyset handover. |

---

## 4. Aggregation Algorithm

Executed on-chain by the `AGGREGATE` crank:

```text
1. Filter Candidate Quotes:
   For each active publisher i in registry:
     Check submission[i].publish_slot >= current_slot - feed.max_staleness_slots
     Check submission[i].source_ts in [block_ts - 30s, block_ts + 5s]
     Check submission[i].quotes[symbol_id].price > 0
   If valid quotes count < registry.min_publishers:
     Set feed.flags |= FEED_FLAG_STALE
     Do not overwrite feed.price or feed.median_source_ts
     Return

2. Pass-1 Median:
   Sort valid quotes in ascending order (insertion sort, N <= 7).
   Compute M1:
     If n is odd:  P[n / 2]
     If n is even: (P[(n/2) - 1] + P[n/2]) / 2

3. Outlier Filter:
   For each quote P[i]:
     dev_bps = (|P[i] - M1| * 10000) / M1
     If dev_bps > feed.outlier_bps:
       Drop P[i]
       Record FEED_FLAG_OUTLIER_REJECTED

4. Pass-2 Consensus:
   If remaining quotes count < registry.min_publishers:
     Set feed.flags |= FEED_FLAG_LOW_CONFIDENCE
     Do not overwrite feed.price
     Return
   Re-sort filtered quotes.
   Compute canonical price M2 = median(filtered_quotes).

5. Dispersion & Confidence (MAD):
   residuals[i] = |filtered_quotes[i] - M2|
   Sort residuals.
   MAD = median(residuals)
   confidence_bps = (MAD * 10000) / M2

6. Flags & State Commit:
   flags = 0
   If feed.price > 0 and (|M2 - feed.price| * 10000) / feed.price >= feed.big_move_bps:
     flags |= FEED_FLAG_BIG_MOVE
   If confidence_bps >= 50:
     flags |= FEED_FLAG_LOW_CONFIDENCE
   If outliers dropped in step 3:
     flags |= FEED_FLAG_OUTLIER_REJECTED

   feed.prev_price = feed.price
   feed.price = M2
   feed.confidence_bps = confidence_bps
   feed.prev_publish_slot = feed.publish_slot
   feed.publish_slot = current_slot
   feed.median_source_ts = median(contributor_source_ts)
   feed.contributor_count = count(filtered_quotes)
   feed.flags = flags

   Emit AggregateUpdated event.
```

---

## 5. Event Format

State changes emit on-chain binary logs via `tsys_emit_event`.

```c
typedef struct {
    uint8_t  event_type;        /* 0x01 */
    uint8_t  symbol_id;
    uint16_t flags;
    uint32_t contributor_mask;
    uint64_t price;
    uint64_t confidence_bps;
    uint64_t publish_slot;
    uint64_t median_source_ts;
} event_aggregate_updated_t;     /* 36 bytes */
```

---

## 6. Migration & Deprecation

1. **Independent Deploy:** Oracle v2 is deployed to a clean program ID.
2. **Shadow Run (7-14 Days):** Feeder processes stream identical market quotes to both v1 and v2. An automated diff monitor checks that $|P_{v2} - P_{v1}| / P_{v1} \le 15\text{ bps}$.
3. **v1 Sunset:** Once downstream consumers switch to the v2 SDK and 7 consecutive days pass with zero critical incidents, v1 ingestion is halted.
