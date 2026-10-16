/**
 * @file decoder.ts
 * @description Zero-copy, little-endian binary wire deserializer for on-chain Oracle storage accounts.
 */
import { type OracleState } from "./types.ts";
/**
 * Deserializes raw Little-Endian binary bytes into an unpacked, indexed OracleState object.
 *
 * @param bytes Raw Uint8Array of account storage data (expected 948 bytes)
 * @param nowSec Optional current timestamp for deterministic age calculation
 * @returns OracleState with pre-indexed bySymbol and byId lookups
 */
export declare function decodeOracleAccount(bytes: Uint8Array, nowSec?: number): OracleState;
/**
 * Decodes a base64-encoded on-chain account data string into OracleState.
 */
export declare function decodeOracleBase64(b64Str: string, nowSec?: number): OracleState;
/**
 * Decodes a hex-encoded on-chain account data string into OracleState.
 */
export declare function decodeOracleHex(hexStr: string, nowSec?: number): OracleState;
//# sourceMappingURL=decoder.d.ts.map