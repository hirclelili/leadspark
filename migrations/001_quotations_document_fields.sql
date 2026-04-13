-- Run in Supabase SQL Editor if quotations already exist without these columns.
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS document_kind TEXT DEFAULT 'PI';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS seller_visible_pl BOOLEAN DEFAULT TRUE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS seller_visible_pi BOOLEAN DEFAULT TRUE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS seller_visible_ci BOOLEAN DEFAULT TRUE;
