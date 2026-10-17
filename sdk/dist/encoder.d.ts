/**
 * @file encoder.ts
 * @description Binary Little-Endian transaction instruction serializer for Thru Quant Oracle.
 */
import { type OracleUpdateArgs } from "./types.ts";
export declare const UPDATE_HEADER_SIZE = 18;
export declare const RESUME_ARGS_SIZE = 6;
/**
 * Serializes an Oracle Price Update instruction payload.
 * Matches C struct `oracle_update_hdr_t` followed by `oracle_entry_t[count]`.
 *
 * @param args OracleUpdateArgs containing entries, regime, timestamp, and account index
 * @returns Little-Endian binary payload (18 + count * 28 bytes)
 */
export declare function encodeOracleUpdate(args: OracleUpdateArgs): Uint8Array;
/**
 * Serializes an Oracle Circuit Breaker Resume instruction payload.
 * Matches C struct `oracle_resume_args_t` (6 bytes canonical wire representation).
 *
 * @param accountIdx Account index within transaction accounts array (typically 2)
 * @returns 6-byte Little-Endian Uint8Array (canonical: 020000000200)
 */
export declare function encodeOracleResume(accountIdx?: number): Uint8Array;
/**
 * Serializes an Oracle Circuit Breaker Rebase instruction payload.
 * Matches C struct `oracle_update_hdr_t` followed by `oracle_entry_t[count]` with opcode REBASE (3).
 * Allows authorized publisher to set clean baseline quotes and reset a tripped breaker.
 *
 * @param args OracleUpdateArgs containing entries, regime, timestamp, and account index
 * @returns Little-Endian binary payload (18 + count * 28 bytes)
 */
export declare function encodeOracleRebase(args: OracleUpdateArgs): Uint8Array;
//# sourceMappingURL=encoder.d.ts.map