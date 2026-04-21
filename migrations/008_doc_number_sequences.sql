-- Migration 008: Document number sequences per user per doc type
-- Each row stores the numbering config + current counter for one doc type.

CREATE TABLE IF NOT EXISTS doc_number_sequences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  doc_type        TEXT NOT NULL,          -- 'Q' | 'PI' | 'CI'
  prefix          TEXT NOT NULL DEFAULT '',
  year_format     TEXT NOT NULL DEFAULT 'YYYY',  -- 'YYYY' | 'YY' | 'YYYYMMDD' | 'none'
  digits          INTEGER NOT NULL DEFAULT 3,     -- zero-pad width (2-5)
  reset_yearly    BOOLEAN NOT NULL DEFAULT true,
  current_year    INTEGER NOT NULL DEFAULT 0,
  current_seq     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, doc_type)
);

ALTER TABLE doc_number_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sequences" ON doc_number_sequences;
CREATE POLICY "Users can manage own sequences" ON doc_number_sequences
  FOR ALL USING (auth.uid() = user_id);

-- Seed default rows for existing users so they get sensible defaults immediately
INSERT INTO doc_number_sequences (user_id, doc_type, prefix, year_format, digits, reset_yearly, current_year, current_seq)
SELECT id, 'Q',  'Q',  'YYYY', 3, true, 0, 0 FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO doc_number_sequences (user_id, doc_type, prefix, year_format, digits, reset_yearly, current_year, current_seq)
SELECT id, 'PI', 'PI', 'YYYY', 3, true, 0, 0 FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO doc_number_sequences (user_id, doc_type, prefix, year_format, digits, reset_yearly, current_year, current_seq)
SELECT id, 'CI', 'CI', 'YYYY', 3, true, 0, 0 FROM auth.users ON CONFLICT DO NOTHING;
