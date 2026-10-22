import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  decodeFeedAccountV2,
  decodeAggregateUpdatedEvent,
  ORACLE_V2_FEED_MAGIC,
  ORACLE_V2_FEED_SIZE,
  ORACLE_V2_EVENT_SIZE,
  V2_FEED_FLAG_BIG_MOVE,
  V2_FEED_FLAG_OUTLIER_REJECTED,
} from "../src/v2_decoder.ts";

describe("Oracle v2 Binary Decoder (v2_decoder.ts)", () => {
  test("rejects buffers smaller than feed size (88 bytes)", () => {
    const buf = new Uint8Array(40);
    assert.throws(
      () => decodeFeedAccountV2(buf),
      (err: any) => err instanceof RangeError && err.message.includes("88 B")
    );
  });

  test("rejects invalid magic", () => {
    const buf = new Uint8Array(ORACLE_V2_FEED_SIZE);
    const view = new DataView(buf.buffer);
    view.setUint32(0, 0x12345678, true);
    assert.throws(
      () => decodeFeedAccountV2(buf),
      (err: any) => err.message.includes("Invalid feed magic")
    );
  });

  test("correctly decodes synthetic valid feed account", () => {
    const buf = new Uint8Array(ORACLE_V2_FEED_SIZE);
    const view = new DataView(buf.buffer);

    view.setUint32(0, ORACLE_V2_FEED_MAGIC, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, 1, true);
    view.setUint32(12, 1, true);
    view.setBigUint64(16, 8401000000000n, true);
    view.setBigUint64(24, 8400000000000n, true);
    view.setBigUint64(32, 25n, true);
    view.setBigUint64(40, 1050n, true);
    view.setBigUint64(48, 1000n, true);
    view.setBigUint64(56, 1700000000n, true);
    view.setUint32(64, 5, true);
    view.setUint32(68, V2_FEED_FLAG_BIG_MOVE | V2_FEED_FLAG_OUTLIER_REJECTED, true);
    view.setUint8(72, 0x1f);

    const decoded = decodeFeedAccountV2(buf);
    assert.equal(decoded.symbolId, 1);
    assert.equal(decoded.status, 1);
    assert.equal(decoded.priceRaw, 8401000000000n);
    assert.equal(decoded.price, 84010.0);
    assert.equal(decoded.confidenceBps, 25);
    assert.equal(decoded.publishSlot, 1050n);
    assert.equal(decoded.contributorCount, 5);
    assert.equal(decoded.isBigMove, true);
    assert.equal(decoded.hadOutlierRejected, true);
    assert.equal(decoded.isStale, false);
    assert.equal(decoded.isLowConfidence, false);
  });

  test("correctly decodes binary aggregate updated event", () => {
    const buf = new Uint8Array(ORACLE_V2_EVENT_SIZE);
    const view = new DataView(buf.buffer);

    view.setUint8(0, 1);
    view.setUint8(1, 2);
    view.setUint16(2, 0, true);
    view.setUint32(4, 0x07, true);
    view.setBigUint64(8, 260100000000n, true);
    view.setBigUint64(16, 5n, true);
    view.setBigUint64(24, 2000n, true);
    view.setBigUint64(32, 1700000005n, true);

    const ev = decodeAggregateUpdatedEvent(buf);
    assert.equal(ev.eventType, 1);
    assert.equal(ev.symbolId, 2);
    assert.equal(ev.priceRaw, 260100000000n);
    assert.equal(ev.price, 2601.0);
    assert.equal(ev.confidenceBps, 5);
    assert.equal(ev.publishSlot, 2000n);
  });
});
