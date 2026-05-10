-- Parallax SaaS — Initial Schema
-- Run: node server/migrations/run.js

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT UNIQUE NOT NULL,
  name                  TEXT,
  avatar_url            TEXT,
  auth_provider         TEXT,
  auth_id               TEXT UNIQUE,
  plan                  TEXT DEFAULT 'free',
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  plan_expires_at       TIMESTAMPTZ,
  storage_used_bytes    BIGINT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  owner_id              UUID REFERENCES users(id),
  plan                  TEXT DEFAULT 'team',
  stripe_subscription_id TEXT,
  max_members           INT DEFAULT 5,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id               UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  role                  TEXT DEFAULT 'member',
  joined_at             TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- Presentations
CREATE TABLE IF NOT EXISTS presentations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id               UUID REFERENCES teams(id) ON DELETE SET NULL,
  title                 TEXT DEFAULT 'Untitled',
  data                  JSONB NOT NULL DEFAULT '{}',
  is_template           BOOLEAN DEFAULT FALSE,
  share_token           TEXT UNIQUE,
  share_enabled         BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presentations_user ON presentations(user_id);
CREATE INDEX IF NOT EXISTS idx_presentations_team ON presentations(team_id);
CREATE INDEX IF NOT EXISTS idx_presentations_share ON presentations(share_token) WHERE share_enabled;

-- Version history
CREATE TABLE IF NOT EXISTS snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id       UUID REFERENCES presentations(id) ON DELETE CASCADE,
  data                  JSONB NOT NULL,
  label                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- File uploads metadata
CREATE TABLE IF NOT EXISTS uploads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id       UUID REFERENCES presentations(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES users(id),
  filename              TEXT NOT NULL,
  storage_key           TEXT NOT NULL,
  content_type          TEXT,
  size_bytes            BIGINT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Plugin registry
CREATE TABLE IF NOT EXISTS plugins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  version               TEXT NOT NULL,
  author_id             UUID REFERENCES users(id),
  price_cents           INT DEFAULT 0,
  price_model           TEXT DEFAULT 'one-time',
  stripe_price_id       TEXT,
  manifest              JSONB NOT NULL DEFAULT '{}',
  published             BOOLEAN DEFAULT FALSE,
  downloads             INT DEFAULT 0,
  avg_rating            NUMERIC(3,2) DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Plugin licenses
CREATE TABLE IF NOT EXISTS plugin_licenses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  plugin_id             UUID REFERENCES plugins(id) ON DELETE CASCADE,
  license_key           TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT,
  status                TEXT DEFAULT 'active',
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plugin_id)
);

-- Plugin reviews
CREATE TABLE IF NOT EXISTS plugin_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id             UUID REFERENCES plugins(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  rating                INT CHECK (rating BETWEEN 1 AND 5),
  comment               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, user_id)
);

-- Per-presentation plugin config
CREATE TABLE IF NOT EXISTS presentation_plugins (
  presentation_id       UUID REFERENCES presentations(id) ON DELETE CASCADE,
  plugin_id             UUID REFERENCES plugins(id) ON DELETE CASCADE,
  config                JSONB DEFAULT '{}',
  PRIMARY KEY (presentation_id, plugin_id)
);

-- GitHub config per user
CREATE TABLE IF NOT EXISTS github_configs (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token                 TEXT DEFAULT '',
  owner                 TEXT DEFAULT '',
  repo                  TEXT DEFAULT ''
);
