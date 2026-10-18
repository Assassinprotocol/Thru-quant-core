# Operational Game-Day Drills

This directory contains reproducible operational drill runbooks used to validate incident response workflows and protocol circuit breakers under simulated failure conditions.

## Drill Index

| Drill ID | Title | Failure Scenario | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **D1** | [Circuit Breaker Trip & Rebase](D1_circuit_breaker_rebase.md) | Volatility spike $> 500$ bps causes on-chain breaker trip. | Feeder transitions to `HOLD`. Operator executes `--rebase`, resetting baseline and clearing breaker. |
| **D2** | [Feeder Crash & Stale Feed Recovery](D2_feeder_recovery_and_stale_feed.md) | Feeder process termination or data source outage ($> 120$s). | `/ready` degrades to HTTP 503 (`stale`). Restart restores monotonic feed without triggering `0x200E`. |
| **D3** | [Unauthorized Signer Rejection](D3_unauthorized_signer_rejection.md) | Rogue key attempts `RESUME` or `REBASE`. | On-chain revert with `0x2003` (`ORACLE_ERR_UNAUTHORIZED`). State account unmodified. |
| **D4** | [Multi-Venue Quorum Outage](D4_multi_venue_quorum_outage.md) | Cross-exchange divergence $> 150$ bps or quorum loss ($< 2$ venues). | Feeder isolates outliers or halts; API emits semantic warnings and enters fail-closed state. |
