# Oracle v2 Binary Layout & Migration Reference

Binary memory layouts, wire formats, and v1-to-v2 migration sequence for Thru Price Hub.

---

## 1. Storage Account Byte Layouts

All structures use explicit 8-byte alignment, packed little-endian encoding, and zero compiler padding.

### 1.1 Registry Account (`registry_account_data_t`)

- **Magic:** `0x54524547` ("TREG")
- **Address Derivation:** PDA `[ProgramID, "registry", AdminMultisigPubkey]`
- **Total Size:** 1,776 bytes

| Offset (Bytes) | Field Name | Type | Size | Description |
|:---:|---|---|:---:|---|
| `0..4` | `magic` | `u32` | 4 B | Fixed magic identifier `0x54524547`. |
| `4..8` | `version` | `u32` | 4 B | Layout version (`2`). |
| `8..12` | `admin_m` | `u32` | 4 B | Multisig threshold $M$. |
| `12..16` | `admin_n` | `u32` | 4 B | Total admin keys $N$ ($M \le N \le 5$). |
| `16..176` | `admin_keys[5]` | `[5][32]u8` | 160 B | Active admin Ed25519 public keys. |
| `176..336` | `pending_admin_keys[5]` | `[5][32]u8` | 160 B | Proposed admin keys during two-step handover. |
| `336..340` | `pending_admin_m` | `u32` | 4 B | Proposed threshold. |
| `340..344` | `pending_admin_n` | `u32` | 4 B | Proposed admin count. |
| `344..352` | `admin_transfer_expiry` | `u64` | 8 B | Handover expiration timestamp. |
| `352..356` | `min_publishers` | `u32` | 4 B | Minimum consensus quorum ($M \ge 3$). |
| `356..360` | `publisher_count` | `u32` | 4 B | Count of enrolled publishers. |
| `360..696` | `publishers[7]` | `[7]publisher_desc` | 336 B | Array of 7 publisher descriptors (48 B each). |
| `696..700` | `feed_count` | `u32` | 4 B | Active feed count. |
| `700..1468` | `feeds[32]` | `[32]feed_config` | 768 B | Array of 32 feed configurations (24 B each). |
| `1468..1472` | `timelock_count` | `u32` | 4 B | Active timelock queue items. |
| `1472..1664` | `timelock_queue[8]` | `[8]timelock_entry` | 192 B | Array of 8 timelock entries (24 B each). |
| `1664..1776` | `_reserved` | `[112]u8` | 112 B | Future expansion padding. |

---

### 1.2 Submission Account (`submission_account_data_t`)

- **Magic:** `0x54535542` ("TSUB")
- **Address Derivation:** PDA `[ProgramID, "submission", PublisherPubkey]`
- **Total Size:** 832 bytes

| Offset (Bytes) | Field Name | Type | Size | Description |
|:---:|---|---|:---:|---|
| `0..4` | `magic` | `u32` | 4 B | Fixed magic identifier `0x54535542`. |
| `4..8` | `version` | `u32` | 4 B | Layout version (`2`). |
| `8..40` | `publisher_pubkey` | `[32]u8` | 32 B | Public key of the submitting publisher. |
| `40..48` | `sequence_number` | `u64` | 8 B | Strictly increasing submission counter. |
| `48..56` | `publish_slot` | `u64` | 8 B | On-chain slot recorded at execution. |
| `56..60` | `quote_count` | `u32` | 4 B | Valid quotes in array. |
| `60..64` | `flags` | `u32` | 4 B | Self-reported flags. |
| `64..832` | `quotes[32]` | `[32]raw_quote` | 768 B | Array of 32 raw quote entries (24 B each). |

---

### 1.3 Feed Account (`feed_account_data_t`)

- **Magic:** `0x54464545` ("TFEE")
- **Address Derivation:** PDA `[ProgramID, "feed", symbol_id]`
- **Total Size:** 88 bytes

| Offset (Bytes) | Field Name | Type | Size | Description |
|:---:|---|---|:---:|---|
| `0..4` | `magic` | `u32` | 4 B | Fixed magic identifier `0x54464545`. |
| `4..8` | `version` | `u32` | 4 B | Layout version (`2`). |
| `8..12` | `symbol_id` | `u32` | 4 B | Canonical asset identifier (e.g. 1=BTC). |
| `12..16` | `status` | `u32` | 4 B | Feed status (1=active, 2=paused). |
| `16..24` | `price` | `u64` | 8 B | Consensus median price (8 decimals). |
| `24..32` | `prev_price` | `u64` | 8 B | Price prior to last consensus update. |
| `32..40` | `confidence_bps` | `u64` | 8 B | Median Absolute Deviation in basis points. |
| `40..48` | `publish_slot` | `u64` | 8 B | Slot at last aggregate execution. |
| `48..56` | `prev_publish_slot` | `u64` | 8 B | Slot prior to last aggregate execution. |
| `56..64` | `median_source_ts` | `u64` | 8 B | Median of contributor venue timestamps. |
| `64..68` | `contributor_count` | `u32` | 4 B | Number of accepted quotes in median. |
| `68..72` | `flags` | `u32` | 4 B | Bitmask: STALE (1), BIG_MOVE (2), LOW_CONF (4), OUTLIER (8). |
| `72..73` | `contributor_mask` | `u8` | 1 B | Bitmask of contributing publisher indices. |
| `73..80` | `_padding` | `[7]u8` | 7 B | Alignment padding. |
| `80..88` | `_reserved` | `u64` | 8 B | Reserved field. |

---

## 2. Migration Protocol (v1 to v2)

1. **Address Separation:** Oracle v2 is deployed to an independent program ID. No existing v1 accounts or balances are overwritten.
2. **Dual-Stack Ingestion:** During the 7–14 day shadow run window, feeder nodes submit quotes concurrently to both v1 and v2 deployments.
3. **Consumer Verification:** Downstream contracts transition read interfaces to the `Consumer Safety Kit` targeting v2 PDA addresses.
4. **v1 Deprecation:** Once parity is confirmed and downstream migration completes, v1 feeder operations are halted and the v1 program authority is permanently revoked.
