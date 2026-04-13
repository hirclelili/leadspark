-- Phase 2: product list vs container grouping for quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quote_mode TEXT DEFAULT 'product_list';

COMMENT ON COLUMN quotations.quote_mode IS 'product_list | container_group';
