export const ORACLE_V2_FEED_MAGIC = 0x54464545;
export const ORACLE_V2_FEED_SIZE = 88;
export const ORACLE_V2_EVENT_SIZE = 40;

export const V2_FEED_FLAG_STALE = 1 << 0;
export const V2_FEED_FLAG_BIG_MOVE = 1 << 1;
export const V2_FEED_FLAG_LOW_CONFIDENCE = 1 << 2;
export const V2_FEED_FLAG_OUTLIER_REJECTED = 1 << 3;

export interface FeedAccountV2 {
  magic: number;
  version: number;
  symbolId: number;
  status: number;
  priceRaw: bigint;
  price: number;
  prevPriceRaw: bigint;
  confidenceBps: number;
  publishSlot: bigint;
  prevPublishSlot: bigint;
  medianSourceTs: bigint;
  contributorCount: number;
  flags: number;
  contributorMask: number;
  isStale: boolean;
  isBigMove: boolean;
  isLowConfidence: boolean;
  hadOutlierRejected: boolean;
}

export interface AggregateUpdatedEvent {
  eventType: number;
  symbolId: number;
  flags: number;
  contributorMask: number;
  priceRaw: bigint;
  price: number;
  confidenceBps: number;
  publishSlot: bigint;
  medianSourceTs: bigint;
}

export function decodeFeedAccountV2(bytes: Uint8Array): FeedAccountV2 {
  if (bytes.length < ORACLE_V2_FEED_SIZE) {
    throw new RangeError(
      `Buffer smaller than Oracle v2 FeedAccount size (${ORACLE_V2_FEED_SIZE} B): got ${bytes.length}`
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== ORACLE_V2_FEED_MAGIC) {
    throw new Error(`Invalid feed magic: expected 0x54464545, got 0x${magic.toString(16)}`);
  }

  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Invalid feed version: expected 2, got ${version}`);
  }

  const symbolId = view.getUint32(8, true);
  const status = view.getUint32(12, true);
  const priceRaw = view.getBigUint64(16, true);
  const prevPriceRaw = view.getBigUint64(24, true);
  const confidenceBps = Number(view.getBigUint64(32, true));
  const publishSlot = view.getBigUint64(40, true);
  const prevPublishSlot = view.getBigUint64(48, true);
  const medianSourceTs = view.getBigUint64(56, true);
  const contributorCount = view.getUint32(64, true);
  const flags = view.getUint32(68, true);
  const contributorMask = view.getUint8(72);

  return {
    magic,
    version,
    symbolId,
    status,
    priceRaw,
    price: Number(priceRaw) / 1e8,
    prevPriceRaw,
    confidenceBps,
    publishSlot,
    prevPublishSlot,
    medianSourceTs,
    contributorCount,
    flags,
    contributorMask,
    isStale: (flags & V2_FEED_FLAG_STALE) !== 0,
    isBigMove: (flags & V2_FEED_FLAG_BIG_MOVE) !== 0,
    isLowConfidence: (flags & V2_FEED_FLAG_LOW_CONFIDENCE) !== 0,
    hadOutlierRejected: (flags & V2_FEED_FLAG_OUTLIER_REJECTED) !== 0,
  };
}

export function decodeAggregateUpdatedEvent(bytes: Uint8Array): AggregateUpdatedEvent {
  if (bytes.length < ORACLE_V2_EVENT_SIZE) {
    throw new RangeError(
      `Buffer smaller than AggregateUpdated event size (${ORACLE_V2_EVENT_SIZE} B): got ${bytes.length}`
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eventType = view.getUint8(0);
  const symbolId = view.getUint8(1);
  const flags = view.getUint16(2, true);
  const contributorMask = view.getUint32(4, true);
  const priceRaw = view.getBigUint64(8, true);
  const confidenceBps = Number(view.getBigUint64(16, true));
  const publishSlot = view.getBigUint64(24, true);
  const medianSourceTs = view.getBigUint64(32, true);

  return {
    eventType,
    symbolId,
    flags,
    contributorMask,
    priceRaw,
    price: Number(priceRaw) / 1e8,
    confidenceBps,
    publishSlot,
    medianSourceTs,
  };
}
