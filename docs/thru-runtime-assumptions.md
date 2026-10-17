# ThruVM Runtime Semantics & Assumptions

**Target:** RISC-V 64-bit (RV64IMAFD) / ThruVM  
**SDK:** `tn_sdk.h`, `tn_sdk_syscall.h`, `tn_sdk.c` (Thru C Program SDK v0.4+)  

---

## 1. Overview

This document specifies the five ThruVM runtime execution assumptions relied upon by `market_oracle` and `clob_engine`. Each assumption is referenced against the Thru C SDK source (`~/.thru/sdk/c/thru-sdk/c/`) and the VM memory segmentation layout.

---

## 2. Core Runtime Assumptions

### Assumption 1: Transaction Abort & Account State Rollback (`tsdk_revert`)

- **Contract Dependency:** When an on-chain invariant is violated (e.g. `0x2001` uninitialized, `0x2007` price limit exceeded, `0x200B` circuit breaker tripped, `0x200E` timestamp regressed), the contract invokes `tsdk_revert(error_code)`. The contract relies on the runtime to discard all dirty modifications written to account buffers during the aborting transaction.
- **SDK Implementation:**
  ```c
  // tn_sdk.c:83-86
  void __attribute__(( noreturn ))
  tsdk_revert( ulong error_code ) {
    tsys_exit( error_code, 1UL );
    __builtin_unreachable( );
  }
  ```
- **Runtime Proof:** `tsdk_revert` invokes `tsys_exit` (syscall `0x0B`) with `revert = 1UL`. In ThruVM, `revert = 1UL` signals the host VM to discard all pending writes to account data segments mapped under `TSDK_SEG_TYPE_ACCOUNT_DATA` (`0x02`), leaving the persisted storage account byte-for-byte identical to its pre-transaction state.
- **Hardening Caveat:** Host-side unit test harnesses using standard C runtimes must implement a state-snapshot restore mechanism (e.g. `longjmp` handler restoring pre-call memory) to prevent state pollution in adversarial test matrices.

---

### Assumption 2: Block Context Availability & Monotonicity (`tsdk_get_current_block_ctx`)

- **Contract Dependency:** The Oracle evaluates freshness invariants (`max_source_time <= block_time + 120s`, `block_time >= max_source_time - 120s`, and lockout breaker duration).
- **SDK Implementation:**
  ```c
  // tn_sdk.c:48-51
  tsdk_block_ctx_t const *
  tsdk_get_current_block_ctx( void ) {
    return (tsdk_block_ctx_t const *)TSDK_ADDR( TSDK_SEG_TYPE_READONLY_DATA,
                                            TSDK_SEG_IDX_BLOCK_CTX, 0UL );
  }
  ```
- **Runtime Proof:** Pointer derivation uses segmented VM addressing:
  ```c
  // tn_sdk.h:31
  #define TSDK_ADDR( seg_type, seg_idx, offset ) (seg_type << 40UL | seg_idx << 24UL | offset)
  ```
  In ThruVM, `TSDK_SEG_TYPE_READONLY_DATA` is pre-populated by the validator runtime prior to bytecode entry. Because the address is computed via bitwise shifts, the pointer itself is structurally non-null in VM space.
- **Fail-Closed Contract Guard:** To protect against edge cases (mock environments, uninitialized genesis slots, or network stalls where `block_time == 0`), the contract explicitly enforces:
  ```c
  if (!ctx || ctx->block_time == 0) {
      tsdk_revert(ORACLE_ERR_CLOCK_UNAVAILABLE); // 0x200D
  }
  ```

---

### Assumption 3: Account Ownership & Write Isolation

- **Contract Dependency:** No third-party program or malicious caller can tamper with an Oracle or CLOB storage account unless the contract explicitly authorizes the write.
- **SDK Implementation:**
  ```c
  // tn_sdk_syscall.h:26
  ulong tsys_set_account_data_writable( ulong account_idx );
  ```
  ```c
  // tn_sdk.c:147-152
  if( memcmp( &target_meta->owner, &accs[ frame->program_acc_idx ],
              sizeof( tn_pubkey_t ) ) == 0 ) {
    return 1;
  }
  tsdk_revert( 0xBAD0A174UL ); /* auth entry for unowned account */
  ```
- **Runtime Proof:** The VM enforces that `tsys_set_account_data_writable` and cross-program invocations (CPI) validate the account's metadata `owner` against the executing program's public key. An attempt to modify an account not owned by `current_program` fails at the kernel level with `0xBAD0A174`.
- **Consumer Verification:** Off-chain clients (SDK and Go daemon) must pin and verify that `account_meta.owner == oracle_program_pubkey` to prevent state-spoofing attacks.

---

### Assumption 4: Ephemeral & Seed-Derived Account Collision Resistance

- **Contract Dependency:** Storage accounts initialized for the Oracle or CLOB must not be hijackable by front-runners during transaction submission.
- **SDK Implementation:**
  ```c
  // tn_sdk_syscall.h:42
  ulong tsys_account_create_ephemeral( ulong account_idx, uchar const seed[TN_SEED_SIZE] );
  ```
- **Runtime Proof:** In ThruVM, address derivation incorporates the caller program's public key:
  $$\text{Address} = \text{BLAKE3}(\text{ProgramID} \parallel \text{Seed})$$
  Because the derived address is cryptographically bound to the executing Program ID, another program cannot claim or initialize an account derived from this program's address space.
- **Operational Requirement:** The deployer must atomically create and initialize the account within the same transaction or pre-calculate the deterministic address and verify the initial authority binding.

---

### Assumption 5: Multi-Signer & Authority Verification Architecture

- **Contract Dependency:** Administrative instructions (`ORACLE_INSTR_RESUME = 2`, `ORACLE_INSTR_REBASE = 3`) must execute only if authorized by the designated admin authority key.
- **SDK Implementation:**
  ```c
  // tn_sdk.c:113-116
  int tsdk_is_account_authorized_by_idx( ushort account_idx ) {
    /* Fee payer is always authorized */
    if( account_idx == 0 ) return 1;
    // ... walks shadow stack for CPI authorization ...
  ```
  ```c
  // tn_sdk.c:165-170
  int tsdk_is_account_authorized_by_pubkey( tn_pubkey_t const * pubkey ) {
    tn_pubkey_t const * accs = tsdk_txn_get_acct_addrs( tsdk_get_txn( ) );
    /* Fee payer is always authorized */
    if( memcmp( pubkey, &accs[ 0 ], sizeof( tn_pubkey_t ) ) == 0 ) return 1;
    // ...
  ```
- **Runtime Proof:** Account 0 in the transaction context is guaranteed by the Thru protocol to be the fee-paying account whose signature was validated before transaction execution. For single-signer operations, matching the authority against `accs[0]` provides cryptographic non-repudiation.
- **Two-Step Rotation Readiness:** When multi-signer transactions or authority rotation (Phase 8 ADR 0001) are introduced, secondary signers must be inspected via the transaction account list and signature bitmask.

---

## 3. Summary of Contract Defenses

| Assumption | Runtime Guarantee | Contract Defense Code |
| :--- | :--- | :--- |
| **A1: State Rollback** | `tsys_exit(code, 1UL)` reverts writes | Fail-closed opcodes, strict input validation |
| **A2: Clock Reliability** | `TSDK_SEG_IDX_BLOCK_CTX` mapped | `0x200D` on null pointer or zero block timestamp |
| **A3: Write Isolation** | Host kernel enforces `owner == program` | Program verification in Go API & TS SDK |
| **A4: Account Binding** | Address derivation binds `ProgramID` | Strict account size check & magic header verification |
| **A5: Signer Authority** | Fee payer signature cryptographically verified | Strict authority match on `RESUME` and `REBASE` |
