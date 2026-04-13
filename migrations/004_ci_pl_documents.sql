-- Phase 3: CI/PL drafts (unified editor state)
CREATE TABLE IF NOT EXISTS ci_pl_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  customer_name TEXT,
  customer_contact TEXT,
  customer_address TEXT,
  container_notes TEXT,
  quote_mode TEXT DEFAULT 'product_list',
  source TEXT,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  products JSONB NOT NULL DEFAULT '[]',
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_pl_documents_user ON ci_pl_documents(user_id, updated_at DESC);

ALTER TABLE ci_pl_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own ci_pl_documents" ON ci_pl_documents;
CREATE POLICY "Users can manage own ci_pl_documents" ON ci_pl_documents FOR ALL USING (auth.uid() = user_id);
