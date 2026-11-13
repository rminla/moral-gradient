CREATE TABLE IF NOT EXISTS reservations (
    reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id TEXT NOT NULL UNIQUE,
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    reserved_usd REAL NOT NULL,
    created_at TEXT NOT NULL,
    reconciled INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calls (
    call_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    model_id TEXT NOT NULL,
    model_version TEXT,
    provider TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    actual_cost_usd REAL NOT NULL,
    duration_ms INTEGER,
    experiment TEXT NOT NULL,
    metadata TEXT,
    mock_data INTEGER DEFAULT 0,
    error TEXT,
    finish_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_calls_experiment ON calls(experiment);
CREATE INDEX IF NOT EXISTS idx_calls_provider ON calls(provider);
