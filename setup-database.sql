-- =============================================================================
-- LeadSpark 数据库设置脚本
-- 在 Supabase Dashboard > SQL Editor 中执行
-- =============================================================================

-- 用户扩展信息
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT,
  company_name_cn TEXT,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  default_currency TEXT DEFAULT 'USD',
  default_payment_terms TEXT DEFAULT 'T/T 30% deposit, 70% before shipment',
  default_validity INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 产品库
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT,
  cost_price NUMERIC NOT NULL,
  unit TEXT DEFAULT 'pc',
  specs TEXT,
  image_url TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 客户
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  address TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'quoted', 'negotiating', 'won', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 报价记录
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  quotation_number TEXT NOT NULL,
  trade_term TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC NOT NULL,
  products JSONB NOT NULL,
  costs JSONB NOT NULL,
  total_amount_foreign NUMERIC NOT NULL,
  total_amount_cny NUMERIC NOT NULL,
  payment_terms TEXT,
  delivery_time TEXT,
  validity_days INTEGER DEFAULT 30,
  packing TEXT,
  remarks TEXT,
  pdf_url TEXT,
  document_kind TEXT DEFAULT 'PI',
  reference_number TEXT,
  seller_visible_pl BOOLEAN DEFAULT TRUE,
  seller_visible_pi BOOLEAN DEFAULT TRUE,
  seller_visible_ci BOOLEAN DEFAULT TRUE,
  po_number TEXT,
  deposit_percent NUMERIC,
  quote_mode TEXT DEFAULT 'product_list',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 客户备注/Remark
CREATE TABLE IF NOT EXISTS customer_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CI / PL 单据草稿（统一编辑层）
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

-- =============================================================================
-- RLS 策略
-- =============================================================================

-- 启用 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_pl_documents ENABLE ROW LEVEL SECURITY;

-- 创建策略
DROP POLICY IF EXISTS "Users can manage own data" ON user_profiles;
DROP POLICY IF EXISTS "Users can manage own products" ON products;
DROP POLICY IF EXISTS "Users can manage own customers" ON customers;
DROP POLICY IF EXISTS "Users can manage own quotations" ON quotations;
DROP POLICY IF EXISTS "Users can manage own remarks" ON customer_remarks;
DROP POLICY IF EXISTS "Users can manage own ci_pl_documents" ON ci_pl_documents;

CREATE POLICY "Users can manage own data" ON user_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own products" ON products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own customers" ON customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own quotations" ON quotations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own remarks" ON customer_remarks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own ci_pl_documents" ON ci_pl_documents FOR ALL USING (auth.uid() = user_id);

-- 完成提示
SELECT 'Database tables and RLS policies created successfully!' as result;