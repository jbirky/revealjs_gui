-- Add expiration support for free-tier presentations

ALTER TABLE presentations
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill: set expires_at for existing free-user presentations
UPDATE presentations p
SET expires_at = p.created_at + INTERVAL '30 days'
FROM users u
WHERE p.user_id = u.id
  AND u.plan = 'free'
  AND p.expires_at IS NULL
  AND p.is_template = false;

CREATE INDEX IF NOT EXISTS idx_presentations_expires
  ON presentations(expires_at)
  WHERE expires_at IS NOT NULL;
