import type {
  DatabaseClient,
  FeedAggregateRecord,
  FeedSnapshotRecord,
  RiskSignalRecord,
  SyncCheckpoint,
} from "./types.ts";

export class MemoryDatabase implements DatabaseClient {
  private checkpoints = new Map<string, SyncCheckpoint>();
  private aggregates = new Map<string, FeedAggregateRecord>();
  private snapshots = new Map<number, FeedSnapshotRecord>();
  private riskSignals = new Map<number, RiskSignalRecord>();
  private priceHistory = new Map<number, number[]>();

  async init(): Promise<void> {}
  async close(): Promise<void> {}

  async getCheckpoint(network: string): Promise<SyncCheckpoint | null> {
    const cp = this.checkpoints.get(network);
    return cp ? { ...cp } : null;
  }

  async saveCheckpoint(checkpoint: SyncCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.network, { ...checkpoint, updatedAt: new Date() });
  }

  async insertAggregate(record: FeedAggregateRecord): Promise<boolean> {
    const key = `${record.symbolId}:${record.publishSlot}`;
    if (this.aggregates.has(key)) {
      return false;
    }
    this.aggregates.set(key, { ...record, createdAt: new Date() });

    let history = this.priceHistory.get(record.symbolId);
    if (!history) {
      history = [];
      this.priceHistory.set(record.symbolId, history);
    }
    history.push(record.price);
    if (history.length > 500) {
      history.shift();
    }
    return true;
  }

  async upsertSnapshot(snapshot: FeedSnapshotRecord): Promise<void> {
    this.snapshots.set(snapshot.symbolId, { ...snapshot, updatedAt: new Date() });
  }

  async getSnapshot(symbolId: number): Promise<FeedSnapshotRecord | null> {
    const s = this.snapshots.get(symbolId);
    return s ? { ...s } : null;
  }

  async listSnapshots(): Promise<FeedSnapshotRecord[]> {
    return Array.from(this.snapshots.values());
  }

  async getRecentPrices(symbolId: number, limit: number): Promise<number[]> {
    const history = this.priceHistory.get(symbolId) || [];
    return history.slice(Math.max(0, history.length - limit));
  }

  async getAggregateBySlot(symbolId: number, slot: bigint): Promise<FeedAggregateRecord | null> {
    const key = `${symbolId}:${slot}`;
    const rec = this.aggregates.get(key);
    return rec ? { ...rec } : null;
  }

  async insertRiskSignal(signal: RiskSignalRecord): Promise<void> {
    this.riskSignals.set(signal.symbolId, { ...signal, createdAt: new Date() });
  }

  async getLatestRiskSignal(symbolId: number): Promise<RiskSignalRecord | null> {
    const sig = this.riskSignals.get(symbolId);
    return sig ? { ...sig } : null;
  }
}

export class PgDatabase implements DatabaseClient {
  private connectionString: string;
  private pool: any = null;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async init(): Promise<void> {
    const pg = await import("pg");
    const Pool = pg.default?.Pool || (pg as any).Pool;
    this.pool = new Pool({ connectionString: this.connectionString });
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async getCheckpoint(network: string): Promise<SyncCheckpoint | null> {
    const res = await this.pool.query(
      "SELECT network, last_processed_slot, last_processed_block_hash, updated_at FROM sync_checkpoints WHERE network = $1",
      [network]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      network: row.network,
      lastProcessedSlot: BigInt(row.last_processed_slot),
      lastProcessedBlockHash: row.last_processed_block_hash,
      updatedAt: row.updated_at,
    };
  }

  async saveCheckpoint(checkpoint: SyncCheckpoint): Promise<void> {
    await this.pool.query(
      `INSERT INTO sync_checkpoints (network, last_processed_slot, last_processed_block_hash, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (network) DO UPDATE
       SET last_processed_slot = EXCLUDED.last_processed_slot,
           last_processed_block_hash = EXCLUDED.last_processed_block_hash,
           updated_at = NOW()`,
      [checkpoint.network, checkpoint.lastProcessedSlot.toString(), checkpoint.lastProcessedBlockHash || null]
    );
  }

  async insertAggregate(record: FeedAggregateRecord): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO feed_aggregates (
         symbol_id, symbol, price_raw, price, confidence_bps, publish_slot,
         prev_publish_slot, median_source_ts, contributor_count, contributor_mask,
         flags, is_stale, is_big_move, is_low_confidence, had_outlier_rejected, tx_signature
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (symbol_id, publish_slot) DO NOTHING
       RETURNING id`,
      [
        record.symbolId,
        record.symbol,
        record.priceRaw.toString(),
        record.price,
        record.confidenceBps,
        record.publishSlot.toString(),
        record.prevPublishSlot.toString(),
        record.medianSourceTs.toString(),
        record.contributorCount,
        record.contributorMask,
        record.flags,
        record.isStale,
        record.isBigMove,
        record.isLowConfidence,
        record.hadOutlierRejected,
        record.txSignature || null,
      ]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async upsertSnapshot(s: FeedSnapshotRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO feed_snapshots (
         symbol_id, symbol, price_raw, price, confidence_bps, publish_slot,
         prev_publish_slot, median_source_ts, flags, contributor_count, contributor_mask, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (symbol_id) DO UPDATE SET
         symbol = EXCLUDED.symbol,
         price_raw = EXCLUDED.price_raw,
         price = EXCLUDED.price,
         confidence_bps = EXCLUDED.confidence_bps,
         publish_slot = EXCLUDED.publish_slot,
         prev_publish_slot = EXCLUDED.prev_publish_slot,
         median_source_ts = EXCLUDED.median_source_ts,
         flags = EXCLUDED.flags,
         contributor_count = EXCLUDED.contributor_count,
         contributor_mask = EXCLUDED.contributor_mask,
         updated_at = NOW()`,
      [
        s.symbolId,
        s.symbol,
        s.priceRaw.toString(),
        s.price,
        s.confidenceBps,
        s.publishSlot.toString(),
        s.prevPublishSlot.toString(),
        s.medianSourceTs.toString(),
        s.flags,
        s.contributorCount,
        s.contributorMask,
      ]
    );
  }

  async getSnapshot(symbolId: number): Promise<FeedSnapshotRecord | null> {
    const res = await this.pool.query(
      "SELECT * FROM feed_snapshots WHERE symbol_id = $1",
      [symbolId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      symbolId: r.symbol_id,
      symbol: r.symbol,
      priceRaw: BigInt(r.price_raw),
      price: Number(r.price),
      confidenceBps: r.confidence_bps,
      publishSlot: BigInt(r.publish_slot),
      prevPublishSlot: BigInt(r.prev_publish_slot),
      medianSourceTs: BigInt(r.median_source_ts),
      flags: r.flags,
      contributorCount: r.contributor_count,
      contributorMask: r.contributor_mask,
      updatedAt: r.updated_at,
    };
  }

  async listSnapshots(): Promise<FeedSnapshotRecord[]> {
    const res = await this.pool.query("SELECT * FROM feed_snapshots ORDER BY symbol_id ASC");
    return res.rows.map((r: any) => ({
      symbolId: r.symbol_id,
      symbol: r.symbol,
      priceRaw: BigInt(r.price_raw),
      price: Number(r.price),
      confidenceBps: r.confidence_bps,
      publishSlot: BigInt(r.publish_slot),
      prevPublishSlot: BigInt(r.prev_publish_slot),
      medianSourceTs: BigInt(r.median_source_ts),
      flags: r.flags,
      contributorCount: r.contributor_count,
      contributorMask: r.contributor_mask,
      updatedAt: r.updated_at,
    }));
  }

  async getRecentPrices(symbolId: number, limit: number): Promise<number[]> {
    const res = await this.pool.query(
      "SELECT price FROM feed_aggregates WHERE symbol_id = $1 ORDER BY publish_slot DESC LIMIT $2",
      [symbolId, limit]
    );
    return res.rows.map((r: any) => Number(r.price)).reverse();
  }

  async getAggregateBySlot(symbolId: number, slot: bigint): Promise<FeedAggregateRecord | null> {
    const res = await this.pool.query(
      "SELECT * FROM feed_aggregates WHERE symbol_id = $1 AND publish_slot = $2 LIMIT 1",
      [symbolId, slot.toString()]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      symbolId: r.symbol_id,
      symbol: r.symbol,
      priceRaw: BigInt(r.price_raw),
      price: Number(r.price),
      confidenceBps: r.confidence_bps,
      publishSlot: BigInt(r.publish_slot),
      prevPublishSlot: BigInt(r.prev_publish_slot),
      medianSourceTs: BigInt(r.median_source_ts),
      contributorCount: r.contributor_count,
      contributorMask: r.contributor_mask,
      flags: r.flags,
      isStale: r.is_stale,
      isBigMove: r.is_big_move,
      isLowConfidence: r.is_low_confidence,
      hadOutlierRejected: r.had_outlier_rejected,
      txSignature: r.tx_signature,
      createdAt: r.created_at,
    };
  }

  async insertRiskSignal(signal: RiskSignalRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO derived_risk_signals (
         symbol_id, symbol, slot, rolling_vol_30m_bps, rolling_vol_1h_bps, rolling_vol_24h_bps, regime_id, depeg_bps, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (symbol_id, slot) DO NOTHING`,
      [
        signal.symbolId,
        signal.symbol,
        signal.slot.toString(),
        signal.rollingVol30mBps,
        signal.rollingVol1hBps,
        signal.rollingVol24hBps,
        signal.regimeId,
        signal.depegBps,
      ]
    );
  }

  async getLatestRiskSignal(symbolId: number): Promise<RiskSignalRecord | null> {
    const res = await this.pool.query(
      "SELECT * FROM derived_risk_signals WHERE symbol_id = $1 ORDER BY slot DESC LIMIT 1",
      [symbolId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      symbolId: r.symbol_id,
      symbol: r.symbol,
      slot: BigInt(r.slot),
      rollingVol30mBps: r.rolling_vol_30m_bps,
      rollingVol1hBps: r.rolling_vol_1h_bps,
      rollingVol24hBps: r.rolling_vol_24h_bps,
      regimeId: r.regime_id,
      depegBps: r.depeg_bps,
      createdAt: r.created_at,
    };
  }
}
