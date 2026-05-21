-- Datasets: user-uploaded tabular data that plugins can query
CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filename TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'parquet', 'tsv')),
  storage_key TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  row_count INTEGER,
  byte_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS presentation_datasets (
  presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  alias TEXT,
  PRIMARY KEY (presentation_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_datasets_user ON datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_pres_datasets_pres ON presentation_datasets(presentation_id);
