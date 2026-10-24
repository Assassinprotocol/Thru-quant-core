import type {
  FeedAccountV2,
  AggregateUpdatedEvent,
} from "@thru-quant/core-sdk";
import type {
  DatabaseClient,
  FeedAggregateRecord,
  FeedSnapshotRecord,
  SyncCheckpoint,
} from "./types.ts";
import { evaluateRiskSignals } from "./risk.ts";

export const SYMBOL_MAP: Record<number, string> = {
  1: "BTC/USD",
  2: "ETH/USD",
  3: "SOL/USD",
  4: "USDT/USD",
  5: "USDC/USD",
  6: "THRU/USD",
  // Backward compatibility fallback for legacy 0-indexed test fixtures
  0: "BTC/USD",
};

export function getSymbolName(symbolId: number): string {
  return SYMBOL_MAP[symbolId] || `ASSET-${symbolId}`;
}

export class SyncEngine {
  private db: DatabaseClient;
  private network: string;

  constructor(db: DatabaseClient, network: string = "betanet") {
    this.db = db;
    this.network = network;
  }

  async processFeedAccount(feed: FeedAccountV2, txSignature?: string): Promise<boolean> {
    const symbol = getSymbolName(feed.symbolId);

    const record: FeedAggregateRecord = {
      symbolId: feed.symbolId,
      symbol,
      priceRaw: feed.priceRaw,
      price: feed.price,
      confidenceBps: feed.confidenceBps,
      publishSlot: feed.publishSlot,
      prevPublishSlot: feed.prevPublishSlot,
      medianSourceTs: feed.medianSourceTs,
      contributorCount: feed.contributorCount,
      contributorMask: feed.contributorMask,
      flags: feed.flags,
      isStale: feed.isStale,
      isBigMove: feed.isBigMove,
      isLowConfidence: feed.isLowConfidence,
      hadOutlierRejected: feed.hadOutlierRejected,
      txSignature,
    };

    const inserted = await this.db.insertAggregate(record);

    const snapshot: FeedSnapshotRecord = {
      symbolId: feed.symbolId,
      symbol,
      priceRaw: feed.priceRaw,
      price: feed.price,
      confidenceBps: feed.confidenceBps,
      publishSlot: feed.publishSlot,
      prevPublishSlot: feed.prevPublishSlot,
      medianSourceTs: feed.medianSourceTs,
      flags: feed.flags,
      contributorCount: feed.contributorCount,
      contributorMask: feed.contributorMask,
    };
    await this.db.upsertSnapshot(snapshot);

    const recentPrices = await this.db.getRecentPrices(feed.symbolId, 60);
    const risk = evaluateRiskSignals(
      feed.symbolId,
      symbol,
      feed.publishSlot,
      recentPrices,
      feed.isLowConfidence,
      feed.hadOutlierRejected
    );
    await this.db.insertRiskSignal(risk);

    return inserted;
  }

  async processAggregateEvent(
    event: AggregateUpdatedEvent,
    txSignature?: string
  ): Promise<boolean> {
    const symbol = getSymbolName(event.symbolId);

    const isStale = (event.flags & 1) !== 0;
    const isBigMove = (event.flags & 2) !== 0;
    const isLowConfidence = (event.flags & 4) !== 0;
    const hadOutlierRejected = (event.flags & 8) !== 0;

    const countBits = (mask: number) => {
      let c = 0;
      let m = mask;
      while (m > 0) {
        c += m & 1;
        m >>= 1;
      }
      return c;
    };

    const record: FeedAggregateRecord = {
      symbolId: event.symbolId,
      symbol,
      priceRaw: event.priceRaw,
      price: event.price,
      confidenceBps: event.confidenceBps,
      publishSlot: event.publishSlot,
      prevPublishSlot: 0n,
      medianSourceTs: event.medianSourceTs,
      contributorCount: countBits(event.contributorMask),
      contributorMask: event.contributorMask,
      flags: event.flags,
      isStale,
      isBigMove,
      isLowConfidence,
      hadOutlierRejected,
      txSignature,
    };

    const inserted = await this.db.insertAggregate(record);

    const currentSnapshot = await this.db.getSnapshot(event.symbolId);
    const prevPublishSlot = currentSnapshot ? currentSnapshot.publishSlot : 0n;

    const snapshot: FeedSnapshotRecord = {
      symbolId: event.symbolId,
      symbol,
      priceRaw: event.priceRaw,
      price: event.price,
      confidenceBps: event.confidenceBps,
      publishSlot: event.publishSlot,
      prevPublishSlot,
      medianSourceTs: event.medianSourceTs,
      flags: event.flags,
      contributorCount: countBits(event.contributorMask),
      contributorMask: event.contributorMask,
    };
    await this.db.upsertSnapshot(snapshot);

    const recentPrices = await this.db.getRecentPrices(event.symbolId, 60);
    const risk = evaluateRiskSignals(
      event.symbolId,
      symbol,
      event.publishSlot,
      recentPrices,
      isLowConfidence,
      hadOutlierRejected
    );
    await this.db.insertRiskSignal(risk);

    return inserted;
  }

  async updateCheckpoint(slot: bigint, blockHash?: string): Promise<void> {
    const cp: SyncCheckpoint = {
      network: this.network,
      lastProcessedSlot: slot,
      lastProcessedBlockHash: blockHash,
    };
    await this.db.saveCheckpoint(cp);
  }

  async getCheckpoint(): Promise<SyncCheckpoint | null> {
    return this.db.getCheckpoint(this.network);
  }
}
