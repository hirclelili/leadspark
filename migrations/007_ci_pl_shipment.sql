-- Phase 4: Add structured shipment fields to ci_pl_documents
ALTER TABLE ci_pl_documents
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS port_of_loading TEXT,
  ADD COLUMN IF NOT EXISTS port_of_discharge TEXT,
  ADD COLUMN IF NOT EXISTS vessel_voyage TEXT,
  ADD COLUMN IF NOT EXISTS container_number TEXT,
  ADD COLUMN IF NOT EXISTS seal_number TEXT,
  ADD COLUMN IF NOT EXISTS trade_term TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;
