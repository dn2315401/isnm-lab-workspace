-- Receipt for the explicitly requested one-time development-library state change.
-- State backfill runs in the authenticated library initialization, not in migrations.
CREATE TABLE IF NOT EXISTS material_test_runs (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  summary TEXT NOT NULL
);
