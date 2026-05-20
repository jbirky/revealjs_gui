-- Custom fonts per user (uploaded TTF/OTF/WOFF or Google Fonts references)
CREATE TABLE IF NOT EXISTS user_fonts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  family_name           TEXT NOT NULL,
  source                TEXT NOT NULL DEFAULT 'upload',
  url                   TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_fonts_user ON user_fonts(user_id);
