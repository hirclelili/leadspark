-- UI/API 已使用 address，旧库可能缺少该列
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
