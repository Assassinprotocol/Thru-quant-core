/**
 * @file encoder.ts
 * @description Binary Little-Endian transaction instruction serializer for Thru Quant Oracle.
 */

import {
  ORACLE_ENTRY_SIZE,
  MAX_ORACLE_SYMBOLS,
  OracleInstruction,
  type OracleUpdateArgs,
} from "./types.ts";

export const UPDATE_HEADER_SIZE = 18;
export const RESUME_ARGS_SIZE = 6;

/**
 * Serializes an Oracle Price Update instruction payload.
 * Matches C struct `oracle_update_hdr_t` followed by `oracle_entry_t[count]`.
 *
 * @param args OracleUpdateArgs containing entries, regime, timestamp, and account index
 * @returns Little-Endian binary payload (18 + count * 28 bytes)
 */
export function encodeOracleUpdate(args: OracleUpdateArgs): Uint8Array {
  if (args.entries.length > MAX_ORACLE_SYMBOLS) {
    throw new RangeError(
      `Cannot encode more than ${MAX_ORACLE_SYMBOLS} symbols in a single update: got ${args.entries.length}`
    );
  }

  const totalLength = UPDATE_HEADER_SIZE + args.entries.length * ORACLE_ENTRY_SIZE;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // Header (18 bytes)
  view.setUint32(0, OracleInstruction.UPDATE_PRICES, true); // uint32 = 1
  view.setUint16(4, args.oracleAccountIdx, true);           // uint16
  view.setUint32(6, args.regimeId, true);                  // uint32
  view.setUint32(10, args.timestamp, true);                // uint32
  view.setUint32(14, args.entries.length, true);           // uint32

  // Entries (28 bytes each)
  let offset = UPDATE_HEADER_SIZE;
  for (const entry of args.entries) {
    view.setUint32(offset, entry.symbolId, true);
    view.setBigUint64(offset + 4, entry.priceQ64Hi, true);
    view.setBigUint64(offset + 12, entry.priceQ64Lo, true);
    view.setUint32(offset + 20, entry.volatilityBps, true);
    view.setUint32(offset + 24, entry.timestamp, true);
    offset += ORACLE_ENTRY_SIZE;
  }

  return new Uint8Array(buffer);
}

/**
 * Serializes an Oracle Circuit Breaker Resume instruction payload.
 * Matches C struct `oracle_resume_args_t` (6 bytes canonical wire representation).
 *
 * @param accountIdx Account index within transaction accounts array (typically 2)
 * @returns 6-byte Little-Endian Uint8Array (canonical: 020000000200)
 */
export function encodeOracleResume(accountIdx: number = 2): Uint8Array {
  const buffer = new ArrayBuffer(RESUME_ARGS_SIZE);
  const view = new DataView(buffer);

  view.setUint32(0, OracleInstruction.RESUME, true); // uint32 = 2
  view.setUint16(4, accountIdx, true);                // uint16

  return new Uint8Array(buffer);
}

/**
 * Serializes an Oracle Circuit Breaker Rebase instruction payload.
 * Matches C struct `oracle_update_hdr_t` followed by `oracle_entry_t[count]` with opcode REBASE (3).
 * Allows authorized publisher to set clean baseline quotes and reset a tripped breaker.
 *
 * @param args OracleUpdateArgs containing entries, regime, timestamp, and account index
 * @returns Little-Endian binary payload (18 + count * 28 bytes)
 */
export function encodeOracleRebase(args: OracleUpdateArgs): Uint8Array {
  if (args.entries.length > MAX_ORACLE_SYMBOLS) {
    throw new RangeError(
      `Cannot encode more than ${MAX_ORACLE_SYMBOLS} symbols in a single rebase: got ${args.entries.length}`
    );
  }

  const totalLength = UPDATE_HEADER_SIZE + args.entries.length * ORACLE_ENTRY_SIZE;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  // Header (18 bytes) with opcode REBASE = 3
  view.setUint32(0, OracleInstruction.REBASE, true); // uint32 = 3
  view.setUint16(4, args.oracleAccountIdx, true);     // uint16
  view.setUint32(6, args.regimeId, true);            // uint32
  view.setUint32(10, args.timestamp, true);          // uint32
  view.setUint32(14, args.entries.length, true);     // uint32

  // Entries (28 bytes each)
  let offset = UPDATE_HEADER_SIZE;
  for (const entry of args.entries) {
    view.setUint32(offset, entry.symbolId, true);
    view.setBigUint64(offset + 4, entry.priceQ64Hi, true);
    view.setBigUint64(offset + 12, entry.priceQ64Lo, true);
    view.setUint32(offset + 20, entry.volatilityBps, true);
    view.setUint32(offset + 24, entry.timestamp, true);
    offset += ORACLE_ENTRY_SIZE;
  }

  return new Uint8Array(buffer);
}
