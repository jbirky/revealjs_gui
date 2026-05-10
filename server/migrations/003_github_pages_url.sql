-- Add pages_url to github_configs for custom GitHub Pages domains
ALTER TABLE github_configs
  ADD COLUMN IF NOT EXISTS pages_url TEXT DEFAULT '';
