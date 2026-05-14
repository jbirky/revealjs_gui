ALTER TABLE uploads ADD COLUMN IF NOT EXISTS file_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_uploads_hash ON uploads (presentation_id, file_hash);
