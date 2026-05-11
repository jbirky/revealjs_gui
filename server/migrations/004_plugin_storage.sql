CREATE TABLE IF NOT EXISTS plugin_storage (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  plugin_id  UUID REFERENCES plugins(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB,
  PRIMARY KEY (user_id, plugin_id, key)
);
