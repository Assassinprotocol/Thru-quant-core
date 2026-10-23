export interface FeedAggregateRecord {
  id?: number;
  symbolId: number;
  symbol: string;
  priceRaw: bigint;
  price: number;
  confidenceBps: number;
  publishSlot: bigint;
  prevPublishSlot: bigint;
  medianSourceTs: bigint;
  contributorCount: number;
  contributorMask: number;
  flags: number;
  isStale: boolean;
  isBigMove: boolean;
  isLowConfidence: boolean;
  hadOutlierRejected: boolean;
  txSignature?: string;
  createdAt?: Date;
}

export interface FeedSnapshotRecord {
  symbolId: number;
  symbol: string;
  priceRaw: bigint;
  price: number;
  confidenceBps: number;
  publishSlot: bigint;
  prevPublishSlot: bigint;
  medianSourceTs: bigint;
  flags: number;
  contributorCount: number;
  contributorMask: number;
  updatedAt?: Date;
}

export interface RiskSignalRecord {
  id?: number;
  symbolId: number;
  symbol: string;
  slot: bigint;
  rollingVol30mBps: number;
  rollingVol1hBps: number;
  rollingVol24hBps: number;
  regimeId: number;
  depegBps: number;
  createdAt?: Date;
}

export interface SyncCheckpoint {
  network: string;
  lastProcessedSlot: bigint;
  lastProcessedBlockHash?: string;
  updatedAt?: Date;
}

export interface DatabaseClient {
  init(): Promise<void>;
  close(): Promise<void>;
  getCheckpoint(network: string): Promise<SyncCheckpoint | null>;
  saveCheckpoint(checkpoint: SyncCheckpoint): Promise<void>;
  insertAggregate(record: FeedAggregateRecord): Promise<boolean>;
  upsertSnapshot(snapshot: FeedSnapshotRecord): Promise<void>;
  getSnapshot(symbolId: number): Promise<FeedSnapshotRecord | null>;
  listSnapshots(): Promise<FeedSnapshotRecord[]>;
  getRecentPrices(symbolId: number, limit: number): Promise<number[]>;
  insertRiskSignal(signal: RiskSignalRecord): Promise<void>;
  getLatestRiskSignal(symbolId: number): Promise<RiskSignalRecord | null>;
}
