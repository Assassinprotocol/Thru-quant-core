# Micro-CLOB Reference Matching Engine (Research Prototype)

**Status:** Research / Experimental Prototype (`Not for Production Use`)  
**Scope Boundary:** Non-Custodial Reference Implementation  
**Target Architecture:** RISC-V 64-bit (RV64IMC)  

---

## 1. Overview & Boundary Notice

This module contains a prototype continuous limit order book (CLOB) engine implemented in C for the ThruVM environment.

> [!WARNING]
> **EXPLICIT NON-CUSTODIAL BOUNDARY:**  
> This orderbook is strictly an in-memory **price-time priority matching engine prototype**.  
> It models FIFO ladder insertion, BBO discovery, and crossing-order execution across doubly-linked list structures, but **DOES NOT IMPLEMENT**:
> - Token program balance escrow / deposit / custody.
> - Account balance debits/credits or financial settlement.
> - Cross-program invocation (CPI) token transfers.

Production DeFi deployment of this matching engine is frozen until **Gate X-03** (Token Escrow CPI integration and sharded account architecture).

---

## 2. Technical Specifications

- **State Size:** `37,924 Bytes` (`clob_state_t`).
- **Ladder Capacity:** 256 active limit orders per side (bids / asks).
- **Complexity:**
  - BBO Query: $O(1)$ constant time via `best_bid_idx` / `best_ask_idx`.
  - Order Insertion / Cancellation: $O(N)$ doubly-linked list traversal.
- **Anti-DoS Gate:** Rejects orders with notional value below `min_notional` prior to insertion.
- **Trader Limit Gate:** Enforces maximum 8 active orders per trader to prevent book saturation.

---

## 3. Standalone Verification

To run standalone unit tests for the research prototype:

```bash
make test-clob
```
