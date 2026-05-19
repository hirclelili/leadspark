ALTER TABLE customer_remarks ADD COLUMN IF NOT EXISTS remark_type TEXT DEFAULT 'note';
