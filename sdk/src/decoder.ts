/**
 * @file decoder.ts
 * @description Zero-copy, little-endian binary wire deserializer for on-chain Oracle storage accounts.
 */

import {
  ORACLE_HEADER_SIZE,
  ORACLE_ENTRY_SIZE,
  MAX_ORACLE_SYMBOLS,
  KnownSymbolMap,
  RegimeNames,
  type OracleEntry,
  type OracleState,
} from "./types.ts";
import { q64ToNumber, q64ToDecimalString } from "./math.ts";

/**
 * Deserializes raw Little-Endian binary bytes into an unpacked, indexed OracleState object.
 *
 * @param bytes Raw Uint8Array of account storage data (expected 948 bytes)
 * @param nowSec Optional current timestamp for deterministic age calculation
 * @returns OracleState with pre-indexed bySymbol and byId lookups
 */
export function decodeOracleAccount(
  bytes: Uint8Array,
  nowSec?: number
): OracleState {
  if (bytes.length < ORACLE_HEADER_SIZE) {
    throw new RangeError(
      `Buffer smaller than oracle header size (52 bytes): got ${bytes.length}`
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const version = view.getUint32(0, true);
  if (version !== 1) {
    throw new Error(`Unsupported oracle state version: expected 1, got ${version}`);
  }

  // Authority pubkey (32 bytes at offset 4)
  let authorityHex = "";
  for (let i = 0; i < 32; i++) {
    authorityHex += bytes[4 + i].toString(16).padStart(2, "0");
  }

  const circuitBreakerActive = view.getUint8(36) !== 0;
  const regimeId = view.getUint32(40, true);
  const lastUpdateTs = view.getUint32(44, true);
  const entryCount = view.getUint32(48, true);

  if (entryCount > MAX_ORACLE_SYMBOLS) {
    throw new RangeError(
      `Oracle entry count exceeds MAX_ORACLE_SYMBOLS (32): got ${entryCount}`
    );
  }

  const requiredSize = ORACLE_HEADER_SIZE + entryCount * ORACLE_ENTRY_SIZE;
  if (bytes.length < requiredSize) {
    throw new RangeError(
      `Binary buffer truncated: got ${bytes.length} bytes, need ${requiredSize}`
    );
  }

  const currentTs = nowSec ?? Math.floor(Date.now() / 1000);
  const feedAgeSec =
    currentTs > lastUpdateTs && lastUpdateTs > 0 ? currentTs - lastUpdateTs : 0;

  const entries: OracleEntry[] = [];
  const bySymbol: Record<string, OracleEntry> = {};
  const byId: Record<number, OracleEntry> = {};

  let offset = ORACLE_HEADER_SIZE;
  for (let i = 0; i < entryCount; i++) {
    const symbolId = view.getUint32(offset, true);
    const priceQ64Hi = view.getBigUint64(offset + 4, true);
    const priceQ64Lo = view.getBigUint64(offset + 12, true);
    const volatilityBps = view.getUint32(offset + 20, true);
    const timestamp = view.getUint32(offset + 24, true);
    offset += ORACLE_ENTRY_SIZE;

    const ageSec =
      currentTs > timestamp && timestamp > 0 ? currentTs - timestamp : 0;
    const symbol = KnownSymbolMap[symbolId] || `UNKNOWN_${symbolId}`;
    const price = q64ToNumber(priceQ64Hi, priceQ64Lo);
    const priceDecimal = q64ToDecimalString(priceQ64Hi, priceQ64Lo, 8);

    const entry: OracleEntry = {
      symbolId,
      symbol,
      priceQ64Hi,
      priceQ64Lo,
      price,
      priceDecimal,
      volatilityBps,
      timestamp,
      ageSec,
    };

    entries.push(entry);
    bySymbol[symbol] = entry;
    byId[symbolId] = entry;
  }

  return {
    version,
    authorityPubkey: authorityHex,
    circuitBreakerActive,
    regimeId,
    regimeName: RegimeNames[regimeId] || "UNKNOWN",
    lastUpdateTs,
    feedAgeSec,
    entryCount,
    entries,
    bySymbol,
    byId,
    sourceMode: "ON_CHAIN_DECODED",
  };
}

/**
 * Decodes a base64-encoded on-chain account data string into OracleState.
 */
export function decodeOracleBase64(
  b64Str: string,
  nowSec?: number
): OracleState {
  const cleanB64 = b64Str.trim().replace(/-/g, "+").replace(/_/g, "/");
  const binaryString =
    typeof Buffer !== "undefined"
      ? Buffer.from(cleanB64, "base64")
      : Uint8Array.from(atob(cleanB64), (c) => c.charCodeAt(0));
  return decodeOracleAccount(new Uint8Array(binaryString), nowSec);
}

/**
 * Decodes a hex-encoded on-chain account data string into OracleState.
 */
export function decodeOracleHex(hexStr: string, nowSec?: number): OracleState {
  const cleanHex = hexStr.trim().startsWith("0x")
    ? hexStr.trim().slice(2)
    : hexStr.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return decodeOracleAccount(bytes, nowSec);
}
