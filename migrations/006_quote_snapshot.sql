-- Dual-block quote: optional JSON snapshot (EXW + logistics totals, PI options)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quote_snapshot JSONB;
