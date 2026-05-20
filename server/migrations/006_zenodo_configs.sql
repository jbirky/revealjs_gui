-- Zenodo API credentials and publication tracking per user
CREATE TABLE IF NOT EXISTS zenodo_configs (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token                 TEXT DEFAULT '',
  sandbox               BOOLEAN DEFAULT FALSE
);

-- Track published depositions per presentation
CREATE TABLE IF NOT EXISTS zenodo_publications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id       UUID REFERENCES presentations(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  deposition_id         INT NOT NULL,
  doi                   TEXT NOT NULL,
  zenodo_url            TEXT NOT NULL,
  sandbox               BOOLEAN DEFAULT FALSE,
  published_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zenodo_pub_pres ON zenodo_publications(presentation_id);
