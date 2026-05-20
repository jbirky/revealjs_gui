-- Zotero API credentials per user (encrypted at rest)
CREATE TABLE IF NOT EXISTS zotero_configs (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  zotero_user_id        TEXT DEFAULT '',
  api_key               TEXT DEFAULT ''
);
