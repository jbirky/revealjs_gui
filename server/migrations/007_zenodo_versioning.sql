-- Add concept_recid to track Zenodo version chains
ALTER TABLE zenodo_publications ADD COLUMN IF NOT EXISTS concept_recid TEXT;
