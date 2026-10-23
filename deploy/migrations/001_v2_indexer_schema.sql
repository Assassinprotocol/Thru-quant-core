CREATE TABLE IF NOT EXISTS sync_checkpoints (
    network VARCHAR(32) PRIMARY KEY,
    last_processed_slot BIGINT NOT NULL,
    last_processed_block_hash VARCHAR(66),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_aggregates (
    id BIGSERIAL PRIMARY KEY,
    symbol_id INT NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    price_raw BIGINT NOT NULL,
    price NUMERIC(20, 8) NOT NULL,
    confidence_bps INT NOT NULL,
    publish_slot BIGINT NOT NULL,
    prev_publish_slot BIGINT NOT NULL,
    median_source_ts BIGINT NOT NULL,
    contributor_count INT NOT NULL,
    contributor_mask INT NOT NULL,
    flags INT NOT NULL,
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    is_big_move BOOLEAN NOT NULL DEFAULT FALSE,
    is_low_confidence BOOLEAN NOT NULL DEFAULT FALSE,
    had_outlier_rejected BOOLEAN NOT NULL DEFAULT FALSE,
    tx_signature VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_feed_aggregates_symbol_slot UNIQUE (symbol_id, publish_slot)
);

CREATE INDEX IF NOT EXISTS idx_feed_aggregates_symbol_slot 
    ON feed_aggregates (symbol, publish_slot DESC);

CREATE INDEX IF NOT EXISTS idx_feed_aggregates_slot 
    ON feed_aggregates (publish_slot DESC);

CREATE TABLE IF NOT EXISTS feed_snapshots (
    symbol_id INT PRIMARY KEY,
    symbol VARCHAR(16) NOT NULL UNIQUE,
    price_raw BIGINT NOT NULL,
    price NUMERIC(20, 8) NOT NULL,
    confidence_bps INT NOT NULL,
    publish_slot BIGINT NOT NULL,
    prev_publish_slot BIGINT NOT NULL,
    median_source_ts BIGINT NOT NULL,
    flags INT NOT NULL,
    contributor_count INT NOT NULL,
    contributor_mask INT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS derived_risk_signals (
    id BIGSERIAL PRIMARY KEY,
    symbol_id INT NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    slot BIGINT NOT NULL,
    rolling_vol_30m_bps INT NOT NULL,
    rolling_vol_1h_bps INT NOT NULL,
    rolling_vol_24h_bps INT NOT NULL,
    regime_id INT NOT NULL,
    depeg_bps INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_risk_signals_symbol_slot UNIQUE (symbol_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_risk_signals_symbol_slot 
    ON derived_risk_signals (symbol_id, slot DESC);

CREATE TABLE IF NOT EXISTS admin_actions (
    id BIGSERIAL PRIMARY KEY,
    action_type VARCHAR(32) NOT NULL,
    symbol_id INT,
    slot BIGINT NOT NULL,
    caller VARCHAR(66) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_slot 
    ON admin_actions (slot DESC);
